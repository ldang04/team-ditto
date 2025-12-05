/**
 * Validation Controller — Integration Tests (no mocks)
 *
 * Integrates:
 * - Express app with real routes and auth middleware.
 * - ValidationController.validate: content loading, embedding generation,
 *   ProjectThemeService, brand consistency calculation, quality scoring.
 * - Supports: stored content (content_id), ad-hoc text, ad-hoc images.
 *
 * External:
 * - Supabase DB for content and embeddings storage.
 * - Vertex AI embeddings (text and multimodal).
 * - Quality scoring heuristics.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import request from "supertest";
import { supabase } from "../../src/config/supabaseClient";
import app from "../../src/app";

describe("Validation Controller Integration", () => {
  jest.setTimeout(60000);
  let apiKey: string | undefined;
  let clientId: string | undefined;
  let projectId: string | undefined;
  let themeId: string | undefined;
  let contentId: string | undefined;

  beforeAll(async () => {
    // Create client
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: `ValCtrl Int ${Date.now()}` });
    expect([200, 201]).toContain(clientRes.status);
    apiKey = clientRes.body?.data?.api_key;
    clientId = clientRes.body?.data?.client_id;

    // Create theme
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: `Validation Test ${Date.now()}`,
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
        name: `ValCtrl Project ${Date.now()}`,
        description: "Professional tech project for validation",
        theme_id: themeId,
        customer_type: "enterprise",
      });
    expect([200, 201]).toContain(projRes.status);
    projectId = projRes.body?.data?.id;

    // Create test content
    const { data: content } = await supabase
      .from("content")
      .insert({
        project_id: projectId,
        media_type: "text",
        text_content: "Modern professional technology solutions for enterprise",
        prompt: "Create professional tech copy",
        enhanced_prompt: "Create professional tech copy",
      })
      .select()
      .single();

    if (content?.id) {
      contentId = content.id;
    }
  });

  /**
   * Integrates: Validation of stored content_id.
   * External: ContentModel.getById, EmbeddingsModel, brand consistency.
   * Validates: returns validation scores and insights.
   */
  it("validates stored content by content_id", async () => {
    if (!apiKey || !contentId) return;

    const res = await request(app)
      .post("/api/validate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ content_id: contentId });

    expect(res.status).toBe(200);
    const validation = res.body?.data?.validation;
    expect(validation?.brand_consistency_score).toBeDefined();
    expect(validation?.quality_score).toBeDefined();
    expect(validation?.overall_score).toBeDefined();
    expect(typeof validation?.passes_validation).toBe("boolean");
    expect(Array.isArray(validation?.strengths)).toBe(true);
    expect(Array.isArray(validation?.issues)).toBe(true);
    expect(Array.isArray(validation?.recommendations)).toBe(true);
  });

  /**
   * Integrates: Ad-hoc text validation.
   * External: EmbeddingService.generateDocumentEmbedding.
   * Validates: validates temporary content without storing.
   */
  it("validates ad-hoc text content", async () => {
    if (!apiKey || !projectId) return;

    const res = await request(app)
      .post("/api/validate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        content: "Enterprise cloud solutions with modern architecture",
        media_type: "text",
      });

    expect(res.status).toBe(200);
    const validation = res.body?.data?.validation;
    expect(typeof validation?.overall_score).toBe("number");
    expect(validation?.overall_score).toBeGreaterThanOrEqual(0);
    expect(validation?.overall_score).toBeLessThanOrEqual(100);
  });

  /**
   * Integrates: Ad-hoc image validation.
   * External: EmbeddingService.generateImageEmbedding, multimodal comparison.
   * Validates: image validation with multimodal embeddings.
   */
  it("validates ad-hoc image using multimodal embeddings", async () => {
    if (!apiKey || !projectId) return;

    // Minimal valid PNG
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHoAFhAJ/wlseKgAAAABJRU5ErkJggg==";

    const res = await request(app)
      .post("/api/validate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        image_base64: pngBase64,
      });

    expect(res.status).toBe(200);
    const validation = res.body?.data?.validation;
    expect(validation?.brand_consistency_score).toBeDefined();
    expect(validation?.quality_score).toBeDefined();
  });

  /**
   * Integrates: Input validation for missing fields.
   * External: Controller validation before processing.
   * Validates: rejects request without required fields.
   */
  it("rejects validation request with missing required fields", async () => {
    if (!apiKey) return;

    const res = await request(app)
      .post("/api/validate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/Must provide/i);
  });

  /**
   * Integrates: Handling non-existent project.
   * External: ProjectThemeService returns null.
   * Validates: returns 404 when project not found.
   */
  it("returns 404 when project not found", async () => {
    if (!apiKey) return;

    const res = await request(app)
      .post("/api/validate")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: "00000000-0000-0000-0000-000000000000",
        content: "Test",
      });

    expect(res.status).toBe(404);
  });

  afterAll(async () => {
    if (contentId) {
      await supabase.from("content").delete().eq("id", contentId);
    }
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
    if (themeId) {
      await supabase.from("themes").delete().eq("id", themeId);
    }
    if (clientId) {
      await supabase.from("clients").delete().eq("id", clientId);
    }
  });
});
