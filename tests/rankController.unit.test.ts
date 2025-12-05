/**
 * RankingController - Unit tests
 *
 * Equivalence Partitioning Map (Unit: RankingController)
 *
 * rank(project_id?, content_ids?, limit?)
 * - R1 Valid: Rank specific content IDs → 200 with ranked list and summary
 * - R2 Valid: Rank all project content → 200 with ranked list and summary
 * - R3 Boundary: No content for project → 200 with empty ranked_content
 * - R4 Boundary: Applies limit correctly → ranked_content truncated, summary totals intact
 * - R5 Invalid: Neither project_id nor content_ids provided → 400
 * - R6 Invalid: content_ids empty or non-array → 400
 * - R7 Invalid: content_ids provided but not found → 404
 * - R8 Invalid: Project/theme not found → 404
 * - R9 Error: DB error on listByProject → 500
 * - R10 Atypical: Scoring error for one content → that item gets zero scores, continues
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import logger from "../src/config/logger";
import { RankingController } from "../src/controllers/RankingController";
import { ContentModel } from "../src/models/ContentModel";
import { EmbeddingsModel } from "../src/models/EmbeddingsModel";
import { EmbeddingService } from "../src/services/EmbeddingService";
import { QualityScoringService } from "../src/services/QualityScoringService";
import { ProjectThemeService } from "../src/services/ProjectThemeService";

// Silence logs
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

// Mock models/services
jest.mock("../src/models/ContentModel");
jest.mock("../src/models/EmbeddingsModel");
jest.mock("../src/services/EmbeddingService");
jest.mock("../src/services/QualityScoringService");
jest.mock("../src/services/ProjectThemeService");

describe("RankingController.rank", () => {
  let req: any;
  let res: any;

  const project = {
    id: "p1",
    description: "Great project",
    goals: "Awareness",
    customer_type: "Tech",
  } as any;
  const theme = {
    id: "t1",
    name: "Modern",
    tags: ["clean", "professional"],
    inspirations: ["Apple"],
  } as any;

  const contents = [
    {
      id: "c1",
      project_id: "p1",
      text_content: "First",
      media_type: "text",
      created_at: "2025-01-01",
    },
    {
      id: "c2",
      project_id: "p1",
      text_content: "Second",
      media_type: "text",
      created_at: "2025-01-02",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    req = { method: "POST", url: "/api/rank", body: {} } as any;
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as any;

    // Default stubs
    (ProjectThemeService.getProjectAndTheme as jest.Mock).mockResolvedValue({
      project,
      theme,
    });
    // Content embeddings exist
    (EmbeddingsModel.getByContentId as jest.Mock).mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      error: null,
    });
    // Brand embeddings + cosine yield brand score ≈ 80
    (EmbeddingService.generateDocumentEmbedding as jest.Mock).mockResolvedValue(
      [1, 0, 0]
    );
    (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.8);
    // Quality scores
    (QualityScoringService.scoreTextQuality as jest.Mock).mockReturnValue(70);
  });

  // R1 Valid: Rank specific IDs
  it("ranks specific content IDs (R1)", async () => {
    req.body = { content_ids: ["c1", "c2"] };
    (ContentModel.getByIds as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.ranked_content.length).toBe(2);
    expect(payload.data.summary.total_ranked).toBe(2);
    // overall = round(0.6*80 + 0.4*70) = 76
    expect(payload.data.ranked_content[0]).toHaveProperty("overall_score");
  });

  // R2 Valid: Rank by project_id
  it("ranks all content for a project (R2)", async () => {
    req.body = { project_id: "p1" };
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.data.summary.project_id).toBe("p1");
    expect(payload.data.summary.theme_id).toBe("t1");
  });

  // R3 Boundary: No content in project
  it("returns empty ranked list when project has no content (R3)", async () => {
    req.body = { project_id: "p1" };
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.data.ranked_content).toEqual([]);
    expect(payload.data.summary.total_ranked).toBe(0);
  });

  // R4 Boundary: Applies limit
  it("applies limit correctly (R4)", async () => {
    req.body = { project_id: "p1", limit: 1 };
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });

    await RankingController.rank(req, res);

    const payload = res.send.mock.calls[0][0];
    expect(payload.data.ranked_content).toHaveLength(1);
    // Summary totals computed before limit
    expect(payload.data.summary.total_ranked).toBe(2);
  });

  // R5 Invalid: Missing both project_id and content_ids
  it("returns 400 when neither project_id nor content_ids provided (R5)", async () => {
    req.body = {};
    await RankingController.rank(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.send.mock.calls[0][0];
    expect(payload.message).toMatch(/either project_id OR content_ids/i);
  });

  // R6 Invalid: content_ids empty array
  it("returns 400 for empty content_ids array (R6)", async () => {
    req.body = { content_ids: [] };
    await RankingController.rank(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  // R7 Invalid: content_ids not found
  it("returns 404 when content_ids not found (R7)", async () => {
    req.body = { content_ids: ["x"] };
    (ContentModel.getByIds as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // R8 Invalid: Project or theme not found
  it("returns 404 when project/theme missing (R8)", async () => {
    req.body = { project_id: "p1" };
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });
    (ProjectThemeService.getProjectAndTheme as jest.Mock).mockResolvedValue(
      null
    );

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // R9 Error: DB error on listByProject
  it("returns 500 when DB errors on listByProject (R9)", async () => {
    req.body = { project_id: "p1" };
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("db"),
    });

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // R10 Atypical: Scoring error for one content → zero scores but continues
  it("continues ranking when one content scoring fails (R10)", async () => {
    req.body = { project_id: "p1" };
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });

    // First content embedding retrieval throws to trigger catch path in scoreAndRankContent
    (EmbeddingsModel.getByContentId as jest.Mock)
      .mockRejectedValueOnce(new Error("embed fail"))
      .mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        error: null,
      });

    await RankingController.rank(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.data.ranked_content).toHaveLength(2);
    // One item should have overall_score 0 due to failure
    const zeroItem = payload.data.ranked_content.find(
      (x: any) => x.overall_score === 0
    );
    expect(zeroItem).toBeDefined();
    expect(zeroItem.recommendation).toMatch(/unable to score/i);
  });
});
