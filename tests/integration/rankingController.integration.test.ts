/**
 * Ranking Controller — Integration Tests (no mocks)
 *
 * Integrates:
 * - RankingController.rank: orchestrates content fetching, scoring, and ranking.
 * - RankingController.scoreAndRankContent: scores via EmbeddingService + QualityScoringService.
 * - RankingController.calculateBrandConsistency: computes alignment via embeddings + cosine similarity.
 * - ProjectThemeService.getProjectAndTheme for theme context.
 *
 * External:
 * - Supabase DB for content, embeddings, projects, themes.
 * - Vertex AI (EmbeddingService) for generating embeddings.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import request from "supertest";
import { supabase } from "../../src/config/supabaseClient";
import app from "../../src/app";

describe("Ranking Controller Integration", () => {
  jest.setTimeout(30000);
  let apiKey: string | undefined;
  let clientId: string | undefined;
  let projectId: string | undefined;
  let themeId: string | undefined;
  const contentIds: string[] = [];

  /**
   * Integrates: ClientController.create → ProjectController.create → ThemeController.create → ProjectThemeService binding.
   * External: Supabase DB writes for test fixtures.
   * Validates: we have a project with theme and content items for ranking.
   */
  beforeAll(async () => {
    // Create client
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "RankingCtrl Int Client" });
    expect([200, 201]).toContain(clientRes.status);
    apiKey = clientRes.body?.data?.api_key;
    clientId = clientRes.body?.data?.client_id;

    // Create theme
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Ranking Test Theme",
        tags: ["modern", "professional"],
        inspirations: ["Apple", "Google"],
      });
    expect([200, 201]).toContain(themeRes.status);
    themeId = themeRes.body?.data?.id;

    // Create project
    const projRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "RankingCtrl Int Project",
        description: "Project for ranking tests",
        theme_id: themeId,
      });
    expect([200, 201]).toContain(projRes.status);
    projectId = projRes.body?.data?.id;

    // Create test content items in DB
    const contents = [
      {
        project_id: projectId,
        media_type: "text",
        text_content: "Modern professional platform for enterprise users",
        enhanced_prompt: "",
        prompt: "Create professional copy",
      },
      {
        project_id: projectId,
        media_type: "text",
        text_content: "Simple greeting hello world",
        enhanced_prompt: "",
        prompt: "Create greeting",
      },
      {
        project_id: projectId,
        media_type: "text",
        text_content: "Apple-inspired minimalist design with clean aesthetics",
        enhanced_prompt: "",
        prompt: "Create minimalist copy",
      },
    ];

    for (const content of contents) {
      const { data, error } = await supabase
        .from("content")
        .insert(content)
        .select()
        .single();
      if (!error && data?.id) {
        contentIds.push(data.id);
      }
    }
  });

  /**
   * Integrates: Ranking endpoint with project_id → ContentModel.listByProject → scoring pipeline.
   * External: Supabase DB queries, EmbeddingService, QualityScoringService.
   * Validates: returns ranked content sorted by overall_score (descending).
   */
  it("ranks all content for project by overall score", async () => {
    if (!projectId || !apiKey) {
      return;
    }

    const res = await request(app)
      .post("/api/rank")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ project_id: projectId });

    expect([200]).toContain(res.status);
    expect(res.body?.data?.ranked_content).toBeDefined();
    expect(Array.isArray(res.body?.data?.ranked_content)).toBe(true);

    // Verify sorting: overall_score should be descending
    const rankedContent = res.body?.data?.ranked_content;
    if (
      rankedContent &&
      Array.isArray(rankedContent) &&
      rankedContent.length > 1
    ) {
      const scores = rankedContent.map((item: Record<string, unknown>) =>
        Number(item.overall_score)
      );
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    }

    // Verify rank assignment
    rankedContent?.forEach((item: Record<string, unknown>, index: number) => {
      expect(Number(item.rank)).toBe(index + 1);
    });
  });

  /**
   * Integrates: Ranking with specific content_ids (vs. project_id).
   * External: ContentModel.getByIds, scoring pipeline.
   * Validates: ranks only specified content items.
   */
  it("ranks specific content_ids provided", async () => {
    if (!apiKey || contentIds.length < 2) {
      return;
    }

    const res = await request(app)
      .post("/api/rank")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ content_ids: contentIds.slice(0, 2) });

    expect([200]).toContain(res.status);
    expect(res.body?.data?.ranked_content?.length).toBe(2);
    expect(res.body?.data?.summary?.total_ranked).toBe(2);
  });

  /**
   * Integrates: Empty content list for project (no content to rank).
   * External: Supabase query returns empty, controller returns graceful response.
   * Validates: returns 200 with empty ranked_content array.
   */
  it("returns 200 with empty ranked_content when project has no content", async () => {
    if (!apiKey) {
      return;
    }

    // Create project with no content
    const emptyProjRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Empty Project" });
    expect([200, 201]).toContain(emptyProjRes.status);
    const emptyProjectId = emptyProjRes.body?.data?.id;

    const res = await request(app)
      .post("/api/rank")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ project_id: emptyProjectId });

    expect(res.status).toBe(200);
    expect(res.body?.data?.ranked_content?.length).toBe(0);
    expect(res.body?.data?.summary?.total_ranked).toBe(0);

    // Cleanup
    if (emptyProjectId) {
      await supabase.from("projects").delete().eq("id", emptyProjectId);
    }
  });

  /**
   * Cleanup: Remove test data after all tests.
   * External: Supabase DB deletes.
   * Validates: no leftover records.
   */
  afterAll(async () => {
    // Delete content
    for (const contentId of contentIds) {
      await supabase.from("content").delete().eq("id", contentId);
    }
    // Delete project
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
    // Delete theme
    if (themeId) {
      await supabase.from("themes").delete().eq("id", themeId);
    }
    // Delete client
    if (clientId) {
      await supabase.from("clients").delete().eq("id", clientId);
    }
  });
});
