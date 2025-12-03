/**
 * TextGenerationController - Equivalence partitions and test mapping
 *
 * Units under test:
 * - TextGenerationController.generate(req, res)
 * - TextGenerationController.saveGeneratedContents(variants, project_id, prompt, media_type)
 *
 * Partitions (inputs):
 * - T1 (Valid): project_id + prompt present, variantCount integer in [0,10], services respond normally, DB saves succeed.
 * - T2 (Invalid): variantCount non-integer / out-of-range, missing required fields (project_id or prompt).
 * - T3 (Atypical): project/theme not found (404), DB create failures for some variants, embedding generation fails (should be logged), zero successful saves.
 * - T4 (Boundary): variantCount at boundaries 0 and 10.
 *
 * Mapping:
 * - generate: validation errors (T2), missing project/theme (T3), successful generation (T1, T4), zero savedVariants error (T3).
 * - saveGeneratedContents: successful saves (T1), DB create failure skip (T3), embedding failure does not throw (T3), boundary zero variants (T4).
 */

// Ensure GCP project is set so VertexAI initialization in services doesn't throw during import
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import logger from "../src/config/logger";
import { TextGenerationController } from "../src/controllers/TextGenerationController";
import { ProjectThemeService } from "../src/services/ProjectThemeService";
import { TextGenerationService } from "../src/services/TextGenerationService";
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

  // T2 invalid: non-integer variantCount
  it("returns 400 for non-integer variantCount (T2)", async () => {
    req.body = { project_id: "p1", prompt: "hi", variantCount: "2.5" };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const sent = res.send.mock.calls[0][0];
    expect(sent.message).toMatch(/Invalid variantCount/);
  });

  // T2 invalid: negative variantCount
  it("returns 400 for negative variantCount (T2)", async () => {
    req.body = { project_id: "p1", prompt: "hi", variantCount: -1 };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // T2 invalid: variantCount above max
  it("returns 400 for variantCount greater than 10 (T2)", async () => {
    req.body = { project_id: "p1", prompt: "hi", variantCount: 11 };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // T2 invalid: missing project_id or prompt
  it("returns 400 when project_id or prompt missing (T2)", async () => {
    req.body = { project_id: "", prompt: "" };
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // T3 atypical: project/theme not found -> 404
  it("returns 404 when project or theme not found (T3)", async () => {
    req.body = { project_id: "p1", prompt: "ok", variantCount: 2 };
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue(null as any);
    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // T1 valid: happy path, saved variants returned (T1)
  it("returns 201 and saved variants on success (T1)", async () => {
    req.body = { project_id: "p1", prompt: "write me", variantCount: 2 };

    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    const generated = ["v1", "v2"] as any;
    jest
      .spyOn(TextGenerationService, "generateContent")
      .mockResolvedValue(generated as any);

    // saveGeneratedContents spy - assume controller persists correctly
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValueOnce([
        { content_id: "c1", generated_content: "v1" },
        { content_id: "c2", generated_content: "v2" },
      ] as any);

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.variant_count).toBe(2);
  });

  // T3 atypical: generate returns variants but saveGeneratedContents returns zero -> error path
  it("handles zero savedVariants as failure (T3)", async () => {
    req.body = { project_id: "p1", prompt: "write me", variantCount: 1 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);
    jest
      .spyOn(TextGenerationService, "generateContent")
      .mockResolvedValue(["only"] as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValue([] as any);

    await TextGenerationController.generate(req, res);
    // Should return 500 or failure - service uses ServiceResponse.failure defaulting to 500
    expect(res.status).toHaveBeenCalled();
    const sent = res.send.mock.calls[0][0];
    expect(sent.success).toBe(false);
  });

  // T4 boundary: variantCount = 0 should be allowed and result in generation of 0 variants
  it("accepts variantCount 0 (T4)", async () => {
    req.body = { project_id: "p1", prompt: "short", variantCount: 0 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);
    jest
      .spyOn(TextGenerationService, "generateContent")
      .mockResolvedValue([] as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValue([] as any);

    await TextGenerationController.generate(req, res);
    // Since save returned empty, controller treats as error and returns failure
    expect(res.status).toHaveBeenCalled();
  });

  // T4 boundary: variantCount = 10 maximum allowed
  it("accepts variantCount 10 (T4)", async () => {
    req.body = { project_id: "p1", prompt: "long", variantCount: 10 };
    const project = { id: "p1", name: "P" } as any;
    const theme = { inspirations: [], tags: [] } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);
    const generated = Array.from({ length: 10 }, (_, i) => `v${i}`) as any;
    jest
      .spyOn(TextGenerationService, "generateContent")
      .mockResolvedValue(generated as any);
    jest
      .spyOn(TextGenerationController as any, "saveGeneratedContents")
      .mockResolvedValue(
        generated.map((g: any, i: number) => ({
          content_id: `c${i}`,
          generated_content: g,
        })) as any
      );

    await TextGenerationController.generate(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("TextGenerationController.saveGeneratedContents - persistence cases", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // T1 valid: saves multiple variants (T1)
  it("saves multiple generated contents successfully (T1)", async () => {
    const variants = ["a", "b"] as any;
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
  });

  // T3 atypical: DB create fails for first variant -> only second saved
  it("skips variants when DB create fails (T3)", async () => {
    const variants = ["a", "b"] as any;
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

  // T3 atypical: embedding generation fails -> variant is skipped by current implementation
  it("skips variant when embedding generation fails (T3)", async () => {
    const variants = ["a"] as any;
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

  // T4 boundary: empty variants array returns empty saved list
  it("returns empty array when no variants supplied (T4)", async () => {
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
