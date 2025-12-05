/**
 * Text Generation Controller — Integration Tests (no mocks)
 *
 * Integrates:
 * - Express app (`src/app.ts`) with real routes and auth middleware.
 * - `TextGenerationController.generate` end-to-end: ProjectThemeService → ContentGenerationPipeline
 *   → EmbeddingService → ContentModel → quality scoring.
 * - Pipeline stages: theme analysis, RAG context, prompt enhancement, Gemini generation, quality scoring.
 *
 * External:
 * - Supabase DB for content persistence and embeddings storage.
 * - Vertex AI (Gemini) for text generation.
 * - Vertex AI embeddings for semantic analysis and diversity metrics.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import request from "supertest";
import { supabase } from "../../src/config/supabaseClient";
import app from "../../src/app";

describe("Text Generation Controller Integration", () => {
  jest.setTimeout(180000);
  let apiKey: string | undefined;
  let clientId: string | undefined;
  let projectId: string | undefined;
  let themeId: string | undefined;
  const contentIds: string[] = [];

  /**
   * Integrates: ClientController.create → ThemeController.create → ProjectController.create → auth binding.
   * External: Supabase DB writes; middleware issues an API key.
   * Validates: we can obtain a working API key, project id, and theme.
   */
  beforeAll(async () => {
    // Create client with unique name
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: `TextGenCtrl Int Client ${Date.now()}` });
    expect([200, 201]).toContain(clientRes.status);
    apiKey = clientRes.body?.data?.api_key;
    clientId = clientRes.body?.data?.client_id;
    expect(typeof apiKey).toBe("string");
    expect(typeof clientId).toBe("string");

    // Create theme
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: `Text Generation Test Theme ${Date.now()}`,
        tags: ["modern", "engaging"],
        inspirations: ["conversational", "professional"],
      });
    expect([200, 201]).toContain(themeRes.status);
    themeId = themeRes.body?.data?.id;
    expect(typeof themeId).toBe("string");

    // Create project
    const projRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: `TextGenCtrl Int Project ${Date.now()}`,
        description: "Project for text generation tests",
        theme_id: themeId,
      });
    expect([200, 201]).toContain(projRes.status);
    projectId = projRes.body?.data?.id;
    expect(typeof projectId).toBe("string");
  });

  /**
   * Integrates: Routing → Auth middleware → TextGenerationController.generate orchestration.
   * External: Vertex AI (Gemini + embeddings), Supabase DB, ContentModel, EmbeddingService.
   * Validates: successful generation returns 201 with variants and quality metrics.
   */
  it("generates text for a valid project and prompt", async () => {
    if (!projectId || !apiKey) return;

    const res = await request(app)
      .post("/api/text/generate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        prompt: "Create engaging social media copy for a tech startup launch",
        variantCount: 1,
      });

    expect([200, 201]).toContain(res.status);
    const data = res.body?.data;
    expect(data?.media_type).toBe("text");
    expect(Array.isArray(data?.variants)).toBe(true);
    expect(data?.variants?.length).toBeGreaterThan(0);
    expect(typeof data?.variants[0]?.generated_content).toBe("string");
    expect(typeof data?.variants[0]?.quality_score).toBe("number");
    expect(typeof data?.quality?.average).toBe("number");
    expect(data?.diversity?.score).toBeDefined();
    expect(data?.theme_analysis?.brand_strength).toBeDefined();

    // Store content IDs for cleanup
    data?.variants?.forEach((v: any) => {
      if (v.content_id) {
        contentIds.push(v.content_id);
      }
    });
  });

  /**
   * Cleanup: Remove all test data after all tests.
   * External: Supabase DB deletes.
   * Validates: no leftover records.
   */
  afterAll(async () => {
    // Delete all generated content
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
