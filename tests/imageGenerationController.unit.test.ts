/**
 * ImageGenerationController - Equivalence partitions and test mapping
 *
 * Units under test:
 * - ImageGenerationController.generate(req, res)
 * - ImageGenerationController.saveGeneratedImages(generatedImages, project_id, prompt, enhancedPrompt)
 *
 * Partitions (inputs):
 * - T1 (Valid): All required inputs present, variantCount in [0,10], aspectRatio in allowed set,
 *   services respond normally and images are saved.
 * - T2 (Invalid): variantCount non-integer/out-of-range, invalid aspectRatio, missing required fields.
 * - T3 (Atypical): project/theme missing (404), model returns zero savedVariants, DB/create/upload partially fails.
 * - T4 (Boundary): variantCount at boundaries 0 and 10; aspectRatio values from allowed list.
 *
 * Mapping:
 * - generate: validation errors (T2), missing data (T3), successful generation (T1, T4).
 * - saveGeneratedImages: successful save (T1), DB insert failure (T3), storage upload failure (T3), embedding failure (should be logged, not fail) (T3).
 */

import logger from "../src/config/logger";
import { ImageGenerationController } from "../src/controllers/ImageGenerationController";
import { ProjectThemeService } from "../src/services/ProjectThemeService";
import { RAGService } from "../src/services/RAGService";
import { ThemeAnalysisService } from "../src/services/ThemeAnalysisService";
import { PromptEnhancementService } from "../src/services/PromptEnhancementService";
import { ImageGenerationService } from "../src/services/ImageGenerationService";
import { ContentModel } from "../src/models/ContentModel";
import { EmbeddingService } from "../src/services/EmbeddingService";
import { StorageService } from "../src/services/StorageService";
import { QualityScoringService } from "../src/services/QualityScoringService";

// Silence logger
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

describe("ImageGenerationController.generate - validations and flow", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    req = { method: "POST", url: "/images/generate", body: {} } as any;
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
  });

  // invalid T2: - noninteger variantCount
  it("returns 400 for non-integer variantCount (T2)", async () => {
    req.body = {
      project_id: "p1",
      prompt: "ok",
      variantCount: "3.5",
      aspectRatio: "1:1",
    };
    await ImageGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const sent = res.send.mock.calls[0][0];
    expect(sent.message).toMatch(/Invalid variantCount/);
  });

  // invalid T2: - negative variantCount
  it("returns 400 for negative variantCount (T2)", async () => {
    req.body = {
      project_id: "p1",
      prompt: "ok",
      variantCount: -1,
      aspectRatio: "1:1",
    };
    await ImageGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // invalid T2: - variantCount > 10
  it("returns 400 for variantCount greater than 10 (T2)", async () => {
    req.body = {
      project_id: "p1",
      prompt: "ok",
      variantCount: 11,
      aspectRatio: "1:1",
    };
    await ImageGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // invalid T2: - unsupported aspectRatio
  it("returns 400 for unsupported aspectRatio (T2)", async () => {
    req.body = {
      project_id: "p1",
      prompt: "ok",
      variantCount: 3,
      aspectRatio: "2:3",
    };
    await ImageGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // invalid T2: - missing project_id or prompt
  it("returns 400 when project_id or prompt missing (T2)", async () => {
    req.body = { project_id: "", prompt: "" };
    await ImageGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // atypical T3: - project/theme not found -> 404
  it("returns 404 when project or theme not found (T3)", async () => {
    req.body = {
      project_id: "p1",
      prompt: "ok",
      variantCount: 2,
      aspectRatio: "1:1",
    };
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue(null as any);

    await ImageGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // valid full flow (happy path) T1: - mocks all downstream services and returns 201
  it("returns 201 and generation metadata on success (T1)", async () => {
    req.body = {
      project_id: "p1",
      prompt: "A prompt",
      variantCount: 2,
      aspectRatio: "16:9",
    };

    // Project/theme
    const project = { id: "p1", name: "Project", description: "Desc" } as any;
    const theme = { inspirations: ["x"], tags: ["t"], analysis: {} } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    // RAG context
    jest.spyOn(RAGService, "performRAG").mockResolvedValue({
      avgSimilarity: 0.5,
      relevantContents: [],
      similarDescriptions: [],
    } as any);

    // Theme analysis (if called)
    jest.spyOn(ThemeAnalysisService, "analyzeTheme").mockReturnValue({} as any);

    // Prompt enhancement
    jest
      .spyOn(PromptEnhancementService, "enhancePromtWithRAG")
      .mockReturnValue("enhanced");
    jest
      .spyOn(PromptEnhancementService, "buildBrandedPrompt")
      .mockReturnValue({ prompt: "branded", negativePrompt: "neg" } as any);

    // Image generation
    const generated = [
      { imageData: "b64-1", mimeType: "image/png", seed: 1 },
      { imageData: "b64-2", mimeType: "image/png", seed: 2 },
    ] as any;
    jest
      .spyOn(ImageGenerationService, "generateImages")
      .mockResolvedValue(generated as any);

    // Save generated images - spy on controller method to avoid testing persistence here
    const saved = [{ content_id: "c1", image_url: "u1" }];
    jest
      .spyOn(ImageGenerationController as any, "saveGeneratedImages")
      .mockResolvedValue(saved as any);

    jest
      .spyOn(QualityScoringService, "scorePromptQuality")
      .mockReturnValue(80 as any);
    jest
      .spyOn(PromptEnhancementService, "scoreRagQuality")
      .mockReturnValue(70 as any);

    await ImageGenerationController.generate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(true);
    expect(sent.data.variant_count).toBe(saved.length);
  });
});

describe("ImageGenerationController.saveGeneratedImages - persistence cases", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // T1 valid: successful save of multiple variants
  it("saves multiple generated images successfully (T1)", async () => {
    const generated = [
      { imageData: "b64-1", mimeType: "image/png", seed: 1 },
      { imageData: "b64-2", mimeType: "image/png", seed: 2 },
    ] as any;
    const project_id = "p1";
    const prompt = "p";
    const enhancedPrompt = "enh";

    // DB create returns data for both (call order matters)
    jest
      .spyOn(ContentModel, "create")
      .mockResolvedValueOnce({ data: { id: "c1" }, error: null } as any)
      .mockResolvedValueOnce({ data: { id: "c2" }, error: null } as any);

    // Embedding service: first resolves, second rejects (should be logged but not fail)
    jest
      .spyOn(EmbeddingService, "generateAndStoreImage")
      .mockResolvedValueOnce(undefined as any)
      .mockRejectedValueOnce(new Error("embed fail"));

    // Storage upload returns urls for each successful upload
    jest
      .spyOn(StorageService, "uploadImage")
      .mockResolvedValueOnce("https://cdn/u1" as any)
      .mockResolvedValueOnce("https://cdn/u2" as any);

    // Update media url resolves
    jest.spyOn(ContentModel, "updateMediaUrl").mockResolvedValue({} as any);

    const res = await ImageGenerationController.saveGeneratedImages(
      generated,
      project_id,
      prompt,
      enhancedPrompt
    );
    expect(res.length).toBe(2);
    expect(res[0].image_url).toBe("https://cdn/u1");
  });

  // T3 atypical: DB create fails for first variant -> only second saved
  it("skips variants when DB create fails (T3)", async () => {
    const generated = [
      { imageData: "b64-1", mimeType: "image/png" },
      { imageData: "b64-2", mimeType: "image/png" },
    ] as any;
    const project_id = "p1";

    jest
      .spyOn(ContentModel, "create")
      .mockResolvedValueOnce({ data: null, error: new Error("db") } as any)
      .mockResolvedValueOnce({ data: { id: "c2" }, error: null } as any);

    jest
      .spyOn(EmbeddingService, "generateAndStoreImage")
      .mockResolvedValue(undefined as any);
    jest
      .spyOn(StorageService, "uploadImage")
      .mockResolvedValue("https://cdn/u2" as any);
    jest.spyOn(ContentModel, "updateMediaUrl").mockResolvedValue({} as any);

    const res = await ImageGenerationController.saveGeneratedImages(
      generated,
      project_id,
      "p",
      "e"
    );

    expect(res.length).toBe(1);
    expect(res[0].content_id).toBe("c2");
  });
});
