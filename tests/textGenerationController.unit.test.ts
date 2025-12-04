/**
 * TextGenerationController - Unit tests
 *
 * Equivalence Partitioning Map (Unit: TextGenerationController)
 *
 * generate(project_id, prompt, variantCount, ...)
 * - G1 Valid: Successful generation and persistence → 201, correct counts
 * - G2 Invalid: Invalid variantCount (non-integer/out-of-range) → 400
 * - G3 Invalid: Missing required fields (project_id or prompt) → 400
 * - G4 Atypical: Project/theme not found → 404
 * - G5 Atypical: Pipeline returns variants but zero saved → failure response
 * - G6 Boundary: variantCount=0 → 201 with variant_count=0
 * - G7 Boundary: variantCount at max (10) and numeric strings accepted → 201
 * - G8 Atypical: Partial saves → 201 with saved count
 * - G9 Valid: Response includes enriched metadata blocks
 *
 * saveGeneratedContents(variants, project_id, prompt, media_type)
 * - S1 Valid: Saves multiple variants with embeddings and returns enriched entries
 * - S2 Atypical: DB create failure skipped; subsequent saves succeed
 * - S3 Atypical: Embedding generation failure skips the variant
 * - S4 Boundary: Empty variants array → empty result
 */

// Ensure GCP project is set so VertexAI initialization in services doesn't throw during import
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import logger from "../src/config/logger";
import { TextGenerationController } from "../src/controllers/TextGenerationController";
import { ProjectThemeService } from "../src/services/ProjectThemeService";
import { ContentGenerationPipeline } from "../src/services/ContentGenerationPipeline";
import { ContentModel } from "../src/models/ContentModel";
import { EmbeddingService } from "../src/services/EmbeddingService";

// silence logger
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

describe("TextGenerationController.generate - validations and flow", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    req = { method: "POST", url: "/text/generate", body: {} } as any;
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
  });

  // G2 Invalid: Non-integer variantCount
  it("returns 400 for non-integer variantCount (G2)", async () => {
    req.body = { project_id: "p1", prompt: "hi", variantCount: "2.5" };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const sent = res.send.mock.calls[0][0];
    expect(sent.message).toMatch(/Invalid variantCount/);
  });

  // G2 Invalid: Negative variantCount
  it("returns 400 for negative variantCount (G2)", async () => {
    req.body = { project_id: "p1", prompt: "hi", variantCount: -1 };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // G2 Invalid: variantCount greater than 10
  it("returns 400 for variantCount greater than 10 (G2)", async () => {
    req.body = { project_id: "p1", prompt: "hi", variantCount: 11 };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // G3 Invalid: Missing project_id or prompt
  it("returns 400 when project_id or prompt missing (G3)", async () => {
    req.body = { project_id: "", prompt: "" };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // G4 Atypical: Project/theme not found → 404
  it("returns 404 when project or theme not found (G4)", async () => {
    req.body = { project_id: "p1", prompt: "ok", variantCount: 2 };
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue(null as any);
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // G1 Valid: Happy path, saved variants returned
  it("returns 201 and saved variants on success (G1)", async () => {
    req.body = { project_id: "p1", prompt: "write me", variantCount: 2 };

    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    // Mock pipeline result with new structure
    const mockPipelineResult = {
      variants: [
        {
          content: "v1",
          qualityScore: 80,
          analysis: {},
          rank: 1,
          compositeScore: 75,
        },
        {
          content: "v2",
          qualityScore: 85,
          analysis: {},
          rank: 2,
          compositeScore: 78,
        },
      ],
      metadata: {
        themeAnalysis: {
          visual_mood: "balanced",
          dominant_styles: [],
          brand_strength: 50,
          color_palette: {},
        },
        ragSimilarity: 0.5,
        ragContentCount: 0,
        enhancedPrompt: "enhanced",
        predictedQuality: 70,
        averageQuality: 82,
        averageCompositeScore: 76,
        diversity: {
          diversity_score: 80,
          avg_pairwise_similarity: 0.2,
          unique_variant_count: 2,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: [],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);

    // saveGeneratedContents spy - assume controller persists correctly
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValueOnce([
        {
          content_id: "c1",
          generated_content: "v1",
          quality_score: 80,
          composite_score: 75,
          rank: 1,
          analysis: {},
        },
        {
          content_id: "c2",
          generated_content: "v2",
          quality_score: 85,
          composite_score: 78,
          rank: 2,
          analysis: {},
        },
      ] as any);

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.variant_count).toBe(2);
  });

  // G5 Atypical: Variants generated but zero persisted → failure path
  it("handles zero savedVariants as failure (G5)", async () => {
    req.body = { project_id: "p1", prompt: "write me", variantCount: 1 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const mockPipelineResult = {
      variants: [
        {
          content: "only",
          qualityScore: 80,
          analysis: {},
          rank: 1,
          compositeScore: 75,
        },
      ],
      metadata: {
        themeAnalysis: {
          visual_mood: "balanced",
          dominant_styles: [],
          brand_strength: 50,
          color_palette: {},
        },
        ragSimilarity: 0,
        ragContentCount: 0,
        enhancedPrompt: "e",
        predictedQuality: 70,
        averageQuality: 80,
        averageCompositeScore: 75,
        diversity: {
          diversity_score: 100,
          avg_pairwise_similarity: 0,
          unique_variant_count: 1,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: [],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValue([] as any);

    await TextGenerationController.generate(req, res);
    // Should return 500 or failure - service uses ServiceResponse.failure defaulting to 500
    expect(res.status).toHaveBeenCalled();
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(false);
  });

  // G6 Boundary: variantCount=0 → 201, variant_count=0
  it("accepts variantCount 0 (G6)", async () => {
    req.body = { project_id: "p1", prompt: "short", variantCount: 0 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const mockPipelineResult = {
      variants: [],
      metadata: {
        themeAnalysis: {
          visual_mood: "balanced",
          dominant_styles: [],
          brand_strength: 50,
          color_palette: {},
        },
        ragSimilarity: 0,
        ragContentCount: 0,
        enhancedPrompt: "e",
        predictedQuality: 70,
        averageQuality: 0,
        averageCompositeScore: 0,
        diversity: {
          diversity_score: 100,
          avg_pairwise_similarity: 0,
          unique_variant_count: 0,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: [],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValue([] as any);

    await TextGenerationController.generate(req, res);
    // With variantCount=0, controller should not treat empty saves as error
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.variant_count).toBe(0);
  });

  // G7 Boundary: variantCount=10 maximum allowed
  it("accepts variantCount 10 (G7)", async () => {
    req.body = { project_id: "p1", prompt: "long", variantCount: 10 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const mockVariants = Array.from({ length: 10 }, (_, i) => ({
      content: `v${i}`,
      qualityScore: 80,
      analysis: {},
      rank: i + 1,
      compositeScore: 75,
    }));
    const mockPipelineResult = {
      variants: mockVariants,
      metadata: {
        themeAnalysis: {
          visual_mood: "balanced",
          dominant_styles: [],
          brand_strength: 50,
          color_palette: {},
        },
        ragSimilarity: 0.5,
        ragContentCount: 0,
        enhancedPrompt: "e",
        predictedQuality: 70,
        averageQuality: 80,
        averageCompositeScore: 75,
        diversity: {
          diversity_score: 70,
          avg_pairwise_similarity: 0.3,
          unique_variant_count: 10,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: [],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValue(
        mockVariants.map((v, i) => ({
          content_id: `c${i}`,
          generated_content: v.content,
          quality_score: v.qualityScore,
          composite_score: v.compositeScore,
          rank: v.rank,
          analysis: v.analysis,
        })) as any
      );

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // G7 Boundary: Accepts numeric string variantCount
  it("accepts numeric string variantCount (G7)", async () => {
    req.body = { project_id: "p1", prompt: "ok", variantCount: "2" };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const mockPipelineResult = {
      variants: [
        {
          content: "a",
          qualityScore: 70,
          analysis: {},
          rank: 1,
          compositeScore: 68,
        },
        {
          content: "b",
          qualityScore: 75,
          analysis: {},
          rank: 2,
          compositeScore: 70,
        },
      ],
      metadata: {
        themeAnalysis: {
          visual_mood: "balanced",
          dominant_styles: [],
          brand_strength: 50,
          color_palette: {},
        },
        ragSimilarity: 0.4,
        ragContentCount: 1,
        enhancedPrompt: "e",
        predictedQuality: 72,
        averageQuality: 72,
        averageCompositeScore: 69,
        diversity: {
          diversity_score: 85,
          avg_pairwise_similarity: 0.15,
          unique_variant_count: 2,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: [],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValueOnce([
        {
          content_id: "c1",
          generated_content: "a",
          quality_score: 70,
          composite_score: 68,
          rank: 1,
          analysis: {},
        },
        {
          content_id: "c2",
          generated_content: "b",
          quality_score: 75,
          composite_score: 70,
          rank: 2,
          analysis: {},
        },
      ] as any);

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.variant_count).toBe(2);
  });

  // G8 Atypical: Partial saves still return 201 with saved count
  it("returns 201 with partial saves; variant_count reflects saved items (G8)", async () => {
    req.body = { project_id: "p1", prompt: "ok", variantCount: 2 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const mockPipelineResult = {
      variants: [
        {
          content: "a",
          qualityScore: 70,
          analysis: {},
          rank: 1,
          compositeScore: 68,
        },
        {
          content: "b",
          qualityScore: 75,
          analysis: {},
          rank: 2,
          compositeScore: 70,
        },
      ],
      metadata: {
        themeAnalysis: {
          visual_mood: "balanced",
          dominant_styles: [],
          brand_strength: 50,
          color_palette: {},
        },
        ragSimilarity: 0.4,
        ragContentCount: 1,
        enhancedPrompt: "e",
        predictedQuality: 72,
        averageQuality: 73,
        averageCompositeScore: 69,
        diversity: {
          diversity_score: 85,
          avg_pairwise_similarity: 0.15,
          unique_variant_count: 2,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: [],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValueOnce([
        {
          content_id: "c1",
          generated_content: "a",
          quality_score: 70,
          composite_score: 68,
          rank: 1,
          analysis: {},
        },
      ] as any);

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.variant_count).toBe(1);
  });

  // G9 Valid: Response includes enriched metadata blocks expected by clients
  it("includes quality, analysis, diversity, theme_analysis and rag_context in response (G9)", async () => {
    req.body = { project_id: "p1", prompt: "ok", variantCount: 1 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const mockPipelineResult = {
      variants: [
        {
          content: "a",
          qualityScore: 70,
          analysis: {
            readability: {},
            tone: {},
            keyword_density: {},
            structure: {},
          },
          rank: 1,
          compositeScore: 68,
        },
      ],
      metadata: {
        themeAnalysis: {
          visual_mood: "warm",
          dominant_styles: ["modern"],
          brand_strength: 60,
          color_palette: { primary: "#000" },
        },
        ragSimilarity: 0.42,
        ragContentCount: 3,
        enhancedPrompt: "e",
        predictedQuality: 72,
        averageQuality: 70,
        averageCompositeScore: 68,
        diversity: {
          diversity_score: 90,
          avg_pairwise_similarity: 0.1,
          unique_variant_count: 1,
          duplicate_pairs: [],
        },
        generationTimestamp: new Date().toISOString(),
        pipelineStages: ["theme_analysis", "rag", "generation", "scoring"],
      },
    };
    jest
      .spyOn(ContentGenerationPipeline, "execute")
      .mockResolvedValue(mockPipelineResult as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValueOnce([
        {
          content_id: "c1",
          generated_content: "a",
          quality_score: 70,
          composite_score: 68,
          rank: 1,
          analysis: {
            readability: {},
            tone: {},
            keyword_density: {},
            structure: {},
          },
        },
      ] as any);

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.quality).toBeDefined();
    expect(sent.data.content_analysis).toBeDefined();
    expect(sent.data.diversity).toBeDefined();
    expect(sent.data.theme_analysis).toBeDefined();
    expect(sent.data.rag_context).toBeDefined();
    expect(Array.isArray(sent.data.pipeline_stages)).toBe(true);
  });
});

describe("TextGenerationController.saveGeneratedContents - persistence cases", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // Helper to create mock VariantWithScore with new marketing analysis structure
  const makeVariant = (content: string, rank = 1) => ({
    content,
    qualityScore: 80,
    analysis: {
      readability: {
        score: 70,
        power_word_count: 3,
        has_cta: true,
        scannability_score: 80,
        level: "moderate",
      },
      tone: {
        urgency_score: 50,
        benefit_score: 60,
        social_proof_score: 30,
        emotional_appeal: 40,
        overall_persuasion: 50,
        label: "strong",
      },
      keyword_density: {
        brand_keyword_count: 2,
        brand_keyword_percentage: 4,
        top_keywords: [],
      },
      structure: {
        sentence_count: 3,
        word_count: 50,
        avg_sentence_length: 17,
        paragraph_count: 1,
      },
    },
    rank,
    compositeScore: 75,
  });

  // S1 Valid: Saves multiple variants
  it("saves multiple generated contents successfully (S1)", async () => {
    const variants = [makeVariant("a", 1), makeVariant("b", 2)] as any;
    const project_id = "p1";
    const prompt = "p";

    jest
      .spyOn(ContentModel, "create")
      .mockResolvedValueOnce({ data: { id: "c1" }, error: null } as any)
      .mockResolvedValueOnce({ data: { id: "c2" }, error: null } as any);
    jest
      .spyOn(EmbeddingService, "generateAndStoreText")
      .mockResolvedValue(undefined as any);

    const res = await TextGenerationController.saveGeneratedContents(
      variants,
      project_id,
      prompt,
      "text"
    );
    expect(res.length).toBe(2);
    expect(res[0].content_id).toBe("c1");
    expect(res[0].quality_score).toBe(80);
    expect(res[0].composite_score).toBe(75);
  });

  // S2 Atypical: DB create fails for first -> only second saved
  it("skips variants when DB create fails (S2)", async () => {
    const variants = [makeVariant("a", 1), makeVariant("b", 2)] as any;
    const project_id = "p1";
    const prompt = "p";

    jest
      .spyOn(ContentModel, "create")
      .mockResolvedValueOnce({ data: null, error: new Error("db") } as any)
      .mockResolvedValueOnce({ data: { id: "c2" }, error: null } as any);
    jest
      .spyOn(EmbeddingService, "generateAndStoreText")
      .mockResolvedValue(undefined as any);

    const res = await TextGenerationController.saveGeneratedContents(
      variants,
      project_id,
      prompt,
      "text"
    );
    expect(res.length).toBe(1);
    expect(res[0].content_id).toBe("c2");
  });

  // S3 Atypical: Embedding generation fails -> variant skipped
  it("skips variant when embedding generation fails (S3)", async () => {
    const variants = [makeVariant("a")] as any;
    const project_id = "p1";
    const prompt = "p";

    jest
      .spyOn(ContentModel, "create")
      .mockResolvedValueOnce({ data: { id: "c1" }, error: null } as any);
    jest
      .spyOn(EmbeddingService, "generateAndStoreText")
      .mockRejectedValueOnce(new Error("embed error"));

    const res = await TextGenerationController.saveGeneratedContents(
      variants,
      project_id,
      prompt,
      "text"
    );
    // current implementation throws on embedding error and skips the variant
    expect(res.length).toBe(0);
  });

  // S4 Boundary: Empty variants array returns empty list
  it("returns empty array when no variants supplied (S4)", async () => {
    const res = await TextGenerationController.saveGeneratedContents(
      [],
      "p1",
      "p",
      "text"
    );
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });
});
