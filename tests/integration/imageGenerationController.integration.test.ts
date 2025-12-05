/**
 * Image Generation Controller — Integration Tests (no mocks)
 *
 * Integrates:
 * - Express app (`src/app.ts`) with real routes and auth middleware.
 * - `ImageGenerationController.generate` end-to-end: RAG → ThemeAnalysis → PromptEnhancement
 *   → ImageGenerationService → StorageService → ContentModel → EmbeddingService.
 * External:
 * - Supabase DB for content persistence.
 * - Vertex AI for embeddings (via EmbeddingService) and Gemini image generation.
 * - Storage provider used by `StorageService.uploadImage`.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import request from "supertest";
import { supabase } from "../../src/config/supabaseClient";
import app from "../../src/app";

describe("Image Generation Controller Integration", () => {
  jest.setTimeout(200000);
  let apiKey: string | undefined;
  let projectId: string | undefined;

  /**
   * Integrates: ClientController.create →  ThemeController.create → ProjectController.create → auth binding.
   * External: Supabase DB writes; middleware issues an API key.
   * Validates: we can obtain a working API key and project id.
   */
  beforeAll(async () => {
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "ImageCtrl Int Client" });
    expect([200, 201]).toContain(clientRes.status);
    apiKey = clientRes.body?.data?.api_key;
    expect(typeof apiKey).toBe("string");

    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Integration Theme",
        tags: ["modern", "professional"],
        inspirations: ["tech", "innovation"],
        font: "Inter",
      });
    expect([200, 201]).toContain(themeRes.status);
    const themeId = themeRes.body?.data?.id;
    expect(typeof themeId).toBe("string");

    const projRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "ImageCtrl Int Project", theme_id: themeId });
    expect([200, 201]).toContain(projRes.status);
    projectId = projRes.body?.data?.id;
    expect(typeof projectId).toBe("string");
  });

  /**
   * Integrates: Routing → Auth middleware → ImageGenerationController.generate orchestration.
   * External: Vertex AI (Gemini + embeddings), Supabase, Storage.
   * Validates: successful generation returns 201 with variants and metrics.
   */
  it("generates images for a valid project and prompt", async () => {
    const res = await request(app)
      .post("/api/images/generate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        prompt: "Professional banner background with modern tech motif",
        aspectRatio: "16:9",
        variantCount: 1,
      });

    expect([201, 200]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      // Minimal structural checks on success
      expect(res.body?.data?.media_type).toBe("image");
      expect(Array.isArray(res.body?.data?.variants)).toBe(true);
      expect(typeof res.body?.data?.project_id).toBe("string");
      expect(res.body?.message).toMatch(/Images generated/i);
    }
  });

  /**
   * Integrates: Input validation branch for `variantCount`.
   * External: Controller returns 400 before service calls.
   * Validates: non-integer or out-of-range variantCount is rejected.
   */
  it("rejects invalid variantCount values", async () => {
    const res = await request(app)
      .post("/api/images/generate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ project_id: projectId, prompt: "x", variantCount: 11 });
    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/Invalid variantCount/i);
  });

  /**
   * Integrates: Input validation branch for `aspectRatio`.
   * External: Controller returns 400 before service calls.
   * Validates: unsupported aspect ratio is rejected.
   */
  it("rejects invalid aspectRatio values", async () => {
    const res = await request(app)
      .post("/api/images/generate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ project_id: projectId, prompt: "x", aspectRatio: "2:1" });
    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/Invalid aspectRatio/i);
  });

  /**
   * Integrates: Missing required fields path.
   * External: Controller returns 400 before orchestration.
   * Validates: missing project_id or prompt yields 400.
   */
  it("rejects when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/images/generate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ project_id: projectId });
    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/Missing required fields/i);
  });

  /**
   * Integrates: Project/theme lookup failure path.
   * External: Real DB read for missing project id.
   * Validates: unknown project id returns 404.
   */
  it("returns 404 when project or theme not found", async () => {
    const res = await request(app)
      .post("/api/images/generate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: "00000000-0000-0000-0000-000000000000",
        prompt: "x",
      });
    expect(res.status).toBe(404);
    expect(res.body?.message).toMatch(/not found/i);
  });

  /**
   * Cleanup: Remove test data after all tests.
   * External: Supabase DB deletes.
   * Validates: no leftover records.
   */
  afterAll(async () => {
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
    const themeRes = await supabase
      .from("themes")
      .select("*")
      .eq("name", "Integration Theme")
      .single();
    if (themeRes.data?.id) {
      await supabase.from("themes").delete().eq("id", themeRes.data.id);
    }
    const clientRes = await supabase
      .from("clients")
      .select("*")
      .eq("name", "ImageCtrl Int Client")
      .single();
    if (clientRes.data?.id) {
      await supabase.from("clients").delete().eq("id", clientRes.data.id);
    }
  });
});
