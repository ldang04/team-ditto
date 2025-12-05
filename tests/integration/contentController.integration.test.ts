/**
 * Content Controller — Integration Tests (no external mocks)
 *
 * What this integrates:
 * - Express app wiring (`src/app.ts`) with real middleware and routes.
 * - Routes → `ContentController` list-by-project endpoint.
 * - Auth middleware: validates `Authorization: Bearer <api_key>`.
 * - Persistence/services: real Supabase client and ContentService path.
 *
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import request from "supertest";
import { supabase } from "../../src/config/supabaseClient";
import app from "../../src/app";

describe("Content Controller Integration", () => {
  let apiKey: string | undefined;
  let projectId: string | undefined;

  /**
   * Integrates: Client creation → Project creation → Auth binding.
   * Validates: a valid API key and project id can be created via real endpoints.
   * External: Real DB writes via Supabase.
   */
  beforeAll(async () => {
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "ContentCtrl Int Client" });
    expect([200, 201]).toContain(clientRes.status);
    apiKey = clientRes.body?.data?.api_key;
    expect(typeof apiKey).toBe("string");

    const projRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "ContentCtrl Int Project" });
    expect([200, 201]).toContain(projRes.status);
    projectId = projRes.body?.data?.id;
    expect(typeof projectId).toBe("string");
  });

  /**
   * Integrates: Routing → Auth middleware → ContentController.list → ContentService.
   * Validates: lists content for a valid project with auth.
   * External: Real DB reads via Supabase; may return empty set if no content yet.
   */
  it("lists contents for a valid project with auth", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`);
    expect([200, 204]).toContain(res.status);
  });

  /**
   * Integrates: Auth middleware rejection path.
   * Validates: missing Authorization header yields 401.
   * External: Controller short-circuited by middleware.
   */
  it("rejects when Authorization header is missing", async () => {
    const res = await request(app).get(`/api/contents/${projectId}`);
    expect(res.status).toBe(401);
  });

  /**
   * Integrates: Auth middleware malformed scheme path.
   * Validates: non-Bearer Authorization yields 401.
   * External: Controller not invoked.
   */
  it("rejects malformed Authorization header", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", apiKey as string);
    expect(res.status).toBe(401);
  });

  /**
   * Integrates: Route param handling + controller.
   * Validates: missing project id in route path returns 404.
   * External: Controller not executed.
   */
  it("returns 404 when project id is missing in path", async () => {
    const res = await request(app)
      .get("/api/contents/")
      .set("Authorization", `Bearer ${apiKey}`);
    expect(res.status).toBe(404);
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
    const clientRes = await supabase
      .from("clients")
      .select("*")
      .eq("name", "ContentCtrl Int Client")
      .single();
    if (clientRes.data?.id) {
      await supabase.from("clients").delete().eq("id", clientRes.data.id);
    }
  });
});
