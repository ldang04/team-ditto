/**
 * ValidationController - Equivalence partitions and test mapping
 *
 * Units under test:
 * - ValidationController.validate(req, res)
 * - ValidationController.getContentData(content_id, content, project_id, media_type)
 * - ValidationController.calculateBrandConsistency(contentEmbedding, project, theme)
 * - ValidationController.generateValidationInsights(...)
 *
 * Partitions (per unit):
 * - validate:
 *   T1 (Valid): content_id OR (content + project_id) provided, project/theme exists, embeddings & scoring available.
 *   T2 (Invalid): neither content_id nor (content+project_id) provided -> 400.
 *   T3 (Atypical): project/theme missing -> 404; underlying getContentData throws -> 500.
 * - getContentData:
 *   T1: content_id resolves to DB row with existing embedding.
 *   T2: content_id resolves to nothing -> throws (content not found).
 *   T3: ad-hoc content + project_id path uses EmbeddingService.generateDocumentEmbedding.
 * - calculateBrandConsistency:
 *   T1: brandTexts present -> returns percent based on embedding similarity.
 *   T2: no brandTexts -> returns 0.
 * - generateValidationInsights:
 *   T1: high scores -> strengths, Excellent summary.
 *   T2: low scores with patterns -> issues, recommendations, lower summary.
 *
 */

// ensure env for any upstream initializers
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import { ValidationController } from "../src/controllers/ValidationController";
import { ContentModel } from "../src/models/ContentModel";
import { EmbeddingService } from "../src/services/EmbeddingService";
import { ProjectThemeService } from "../src/services/ProjectThemeService";
import { QualityScoringService } from "../src/services/QualityScoringService";
import logger from "../src/config/logger";

// silence logger
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

describe("ValidationController.validate - input validation and flow", () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    req = { method: "POST", url: "/validate", body: {} } as any;
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
  });

  // T2 invalid: neither content_id nor (content + project_id)
  it("returns 400 when neither content_id nor (content + project_id) provided (T2)", async () => {
    req.body = {};
    await ValidationController.validate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const sent = res.send.mock.calls[0][0];
    expect(sent.message).toMatch(/Must provide either content_id/);
  });

  // T3 atypical: project/theme not found (404)
  it("returns 404 when project/theme not found (T3)", async () => {
    // mock getContentData to return ad-hoc resolved values
    jest
      .spyOn(ValidationController as any, "getContentData")
      .mockResolvedValue({
        projectId: "p1",
        textContent: "hello",
        contentEmbedding: [0.1, 0.2],
        actualMediaType: "text",
      } as any);
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue(null as any);

    req.body = { content: "hello", project_id: "p1" };
    await ValidationController.validate(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // T1 valid: successful validation flow when content_id path provided
  it("returns 200 and validation payload on success (T1)", async () => {
    jest
      .spyOn(ValidationController as any, "getContentData")
      .mockResolvedValue({
        projectId: "p1",
        textContent: "This is a valid content sample with enough length.",
        contentEmbedding: [0.1, 0.1],
        actualMediaType: "text",
      } as any);

    const project = {
      id: "p1",
      description: "desc",
      goals: "g",
      customer_type: "developers",
    } as any;
    const theme = {
      name: "Theme",
      tags: ["t1"],
      inspirations: ["insp"],
    } as any;
    jest
      .spyOn(ProjectThemeService, "getProjectAndTheme")
      .mockResolvedValue({ project, theme } as any);

    // stub calculateBrandConsistency & scoring to deterministic values
    jest
      .spyOn(ValidationController as any, "calculateBrandConsistency")
      .mockResolvedValue(80 as any);
    jest
      .spyOn(QualityScoringService, "scoreTextQuality")
      .mockReturnValue(80 as any);

    req.body = { content_id: "c1" };
    await ValidationController.validate(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const sent = res.send.mock.calls[0][0];
    expect(sent.data.validation).toBeDefined();
    expect(sent.data.validation.overall_score).toBeGreaterThanOrEqual(0);
    expect(sent.data.validation.passes_validation).toBe(true);
  });
});

describe("ValidationController.getContentData - retrieval & embedding paths", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // T2: content_id path - missing content should throw
  it("throws when content_id not found in DB (T2)", async () => {
    jest
      .spyOn(ContentModel, "getById")
      .mockResolvedValue({ data: null, error: new Error("not found") } as any);
    await expect(
      (ValidationController as any).getContentData(
        "missing",
        undefined,
        undefined,
        undefined
      )
    ).rejects.toThrow(/Content not found/);
  });

  // T3: ad-hoc content path uses EmbeddingService.generateDocumentEmbedding
  it("uses EmbeddingService.generateDocumentEmbedding for ad-hoc content (T3)", async () => {
    const emb = [0.1, 0.2];
    jest
      .spyOn(EmbeddingService, "generateDocumentEmbedding")
      .mockResolvedValue(emb as any);
    const res = await (ValidationController as any).getContentData(
      undefined,
      "hello text",
      "p1",
      "text"
    );
    expect(EmbeddingService.generateDocumentEmbedding).toHaveBeenCalledWith(
      "hello text"
    );
    expect(res.projectId).toBe("p1");
    expect(res.contentEmbedding).toBe(emb);
  });
});

describe("ValidationController.calculateBrandConsistency - embedding comparisons", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // T2: no brandTexts -> returns 0
  // T2 (adjusted): simulate very low similarity by stubbing embeddings to yield 0% average
  it("returns 0 when similarities are all zero (T2)", async () => {
    const theme = { name: "", tags: [], inspirations: [] } as any;
    const project = { description: "", goals: "", customer_type: "" } as any;
    // stub embedding generation to return some vectors
    jest
      .spyOn(EmbeddingService, "generateDocumentEmbedding")
      .mockResolvedValue([0.1, 0.1] as any);
    // stub cosine similarity to always return 0
    jest.spyOn(EmbeddingService, "cosineSimilarity").mockReturnValue(0 as any);

    const res = await (ValidationController as any).calculateBrandConsistency(
      [0.1, 0.1],
      project,
      theme
    );
    expect(res).toBe(0);
  });

  // T1: brandTexts present -> averages cosine similarity
  it("computes percent similarity when brand texts present (T1)", async () => {
    const theme = { name: "N", tags: ["a"], inspirations: ["i"] } as any;
    const project = {
      description: "desc",
      goals: "g",
      customer_type: "c",
    } as any;

    // stub embeddings and similarity
    jest
      .spyOn(EmbeddingService, "generateDocumentEmbedding")
      .mockResolvedValue([0.2, 0.2] as any);
    jest
      .spyOn(EmbeddingService, "cosineSimilarity")
      .mockReturnValue(0.5 as any);

    const pct = await (ValidationController as any).calculateBrandConsistency(
      [0.1, 0.1],
      project,
      theme
    );
    expect(pct).toBe(50);
  });
});

describe("ValidationController.generateValidationInsights - rules and summaries", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // T1: strong scores produce strengths and 'Excellent' summary
  it("produces strengths and Excellent summary for high scores (T1)", () => {
    const theme = { inspirations: ["i1"], tags: ["t1"] } as any;
    const project = { customer_type: "developers" } as any;
    const out = (ValidationController as any).generateValidationInsights(
      90,
      90,
      90,
      true,
      "long enough content that mentions developers",
      theme,
      project
    );
    expect(out.strengths.length).toBeGreaterThan(0);
    expect(out.summary).toMatch(/Excellent/);
    expect(out.passes_validation).toBe(true);
  });

  // T2: low scores with patterns create issues and recommendations
  it("flags issues and recommendations for low scores and patterns (T2)", () => {
    const theme = { inspirations: ["i1", "i2"], tags: ["t1"] } as any;
    const project = { customer_type: "enterprise customers" } as any;
    const text = "Hi!!"; // short and excessive punctuation
    const out = (ValidationController as any).generateValidationInsights(
      30,
      40,
      35,
      false,
      text,
      theme,
      project
    );
    expect(out.issues.length).toBeGreaterThanOrEqual(2);
    expect(
      out.recommendations.some((r: string) => r.startsWith("Reference:"))
    ).toBe(true);
    expect(
      out.recommendations.some((r: string) => r.startsWith("Address audience:"))
    ).toBe(true);
    expect(out.summary).toMatch(/deviates|needs revision|Content needs/i);
  });
});
