/**
 * Rank API — Integration Scope + Partitions
 *
 * Internal integrations exercised:
 * - `routes/rank.routes.ts` → `RankController` (ranking by `project_id` or `content_ids`)
 * - `authMiddleware` for API key validation
 * - `ContentService`/`ContentModel` for fetching content
 * - `ProjectController`/`ProjectService` for project creation and theme association prerequisite
 * - `ThemeController`/`ThemeService` for theme association checks
 * - `QualityScoringService`/`RAGService` (indirect, if used by ranking pipeline)
 * - `supabaseClient` (mocked) for DB-backed entities; `resetMockTables()` used in setup
 *
 * External integrations: none (ranking pipeline runs against mocked storage/DB).
 *
 * Equivalence Partitioning Map (API: Rank)
 * - Authorization header (`Bearer <apiKey>`)
 *   - P1 Valid: Proper `Bearer <validKey>` → 200
 *   - P2 Invalid: Missing or malformed header → 401
 *   - P3 Invalid: Well-formed but invalid/unknown key → 403 (may be 401 in edge cases)
 *   - P4 Boundary: `Bearer ` with empty token → 401
 *
 * - Request body
 *   - R1 Valid: `content_ids` provided → 200 with ranked_content
 *   - R2 Valid: `project_id` provided → 200 with ranked_content
 *   - R3 Boundary: `limit` applied → ranked_content truncated; summary totals intact
 *   - R4 Boundary: Project with no content → 200 with empty ranked_content
 *   - R5 Invalid: Neither `project_id` nor `content_ids` provided → 400
 *   - R6 Invalid: `content_ids` empty → 400
 *   - R7 Invalid: `content_ids` not found → 404
 *   - R8 Invalid: Project/theme not found → 404
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";
jest.setTimeout(20000);

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import { ContentModel } from "../src/models/ContentModel";

describe("Rank API", () => {
  let apiKey: string;
  let projectId: string;
  let contentIds: string[] = [];
  let themeId: string;

  beforeAll(async () => {
    resetMockTables();

    // Create client → obtain apiKey
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "Rank API Client" });
    expect(clientRes.status).toBe(201);
    apiKey = clientRes.body.data.api_key;

    // Create a project for this client
    const projectRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Rank Project" });
    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;

    // Create a theme for this client and attach to project (required by ranking)
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Primary Theme", tags: ["modern", "clean"] });
    expect(themeRes.status).toBe(201);
    themeId = themeRes.body.data.id;

    const updRes = await request(app)
      .put(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ theme_id: themeId });
    expect(updRes.status).toBe(200);

    // Seed two content rows for the project using the model (in-memory supabase mock)
    const c1 = await ContentModel.create({
      project_id: projectId,
      media_type: "text",
      media_url: "text",
      text_content: "First marketing copy",
      prompt: "p",
    } as any);
    const c2 = await ContentModel.create({
      project_id: projectId,
      media_type: "text",
      media_url: "text",
      text_content: "Second marketing copy",
      prompt: "p",
    } as any);
    const id1 = c1.data?.id as string;
    const id2 = c2.data?.id as string;
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    contentIds = [id1, id2];
  });

  describe("POST /api/rank (authorized)", () => {
    // R1 (P1) Valid: content_ids provided
    // Integrations: authMiddleware (P1), RankController ranks provided ids via ContentService/Model, prerequisite theme association checked
    it("ranks specific content ids (R1)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ content_ids: contentIds });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.ranked_content.length).toBe(2);
      expect(res.body.data.summary.total_ranked).toBe(2);
    });

    // R2 (P1) Valid: project_id provided
    // Integrations: controller fetches project content and ranks; theme association prerequisite
    it("ranks by project_id (R2)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.project_id).toBe(projectId);
    });

    // R3 (P1) Boundary: limit applied
    // Integrations: controller applies limit to ranked_content while preserving summary totals
    it("applies limit (R3)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.ranked_content.length).toBe(1);
      expect(res.body.data.summary.total_ranked).toBe(2);
    });

    // R4 (P1) Boundary: project with no content
    // Integrations: ranking pipeline returns empty array for empty project
    it("returns empty when project has no content (R4)", async () => {
      const resProj = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "Empty Project" });
      const emptyProjectId = resProj.body.data.id;

      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: emptyProjectId });

      expect(res.status).toBe(200);
      expect(res.body.data.ranked_content).toEqual([]);
      expect(res.body.data.summary.total_ranked).toBe(0);
    });
  });

  describe("POST /api/rank - invalid inputs", () => {
    // R5 (P1) Invalid: missing both project_id and content_ids
    // Integrations: controller validation rejects; ranking not executed
    it("returns 400 when missing both project_id and content_ids (R5)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({});
      expect(res.status).toBe(400);
    });

    // R6 (P1) Invalid: content_ids empty array
    // Integrations: controller validation rejects; ranking not executed
    it("returns 400 when content_ids is empty (R6)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ content_ids: [] });
      expect(res.status).toBe(400);
    });

    // R7 (P1) Invalid: content_ids not found
    // Integrations: content fetch returns not-found; controller responds 404
    it("returns 404 for unknown content_ids (R7)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ content_ids: ["does-not-exist"] });
      expect(res.status).toBe(404);
    });

    // R8 (P1) Invalid: project/theme missing
    // Integrations: project exists but lacks theme association; controller responds 404
    it("returns 404 when project/theme missing (R8)", async () => {
      // Create a project WITHOUT a theme, and add content to trigger theme fetch
      const projRes = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "No Theme Project" });
      expect(projRes.status).toBe(201);
      const noThemeProjectId = projRes.body.data.id;

      // Seed content for this project to ensure non-empty ranking path
      const cA = await ContentModel.create({
        project_id: noThemeProjectId,
        media_type: "text",
        media_url: "text",
        text_content: "Content needs theme",
        prompt: "p",
      } as any);
      expect(cA.data?.id).toBeTruthy();

      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: noThemeProjectId });
      expect(res.status).toBe(404);
    });
  });

  describe("Authorization partitions", () => {
    // P2 Invalid: missing Authorization header
    // Integrations: authMiddleware rejects; controller short-circuits
    it("rejects missing Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .send({ project_id: projectId });
      expect(res.status).toBe(401);
    });

    // P2 Invalid: malformed Authorization header scheme
    // Integrations: authMiddleware rejects wrong scheme
    it("rejects malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", `Bearerr ${apiKey}`)
        .send({ project_id: projectId });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Missing API key");
    });

    // P4 Boundary: empty Bearer token
    // Integrations: empty token treated as missing
    it("rejects empty Bearer token (P4)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", "Bearer ")
        .send({ project_id: projectId });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Missing API key");
    });

    // P3 Invalid: unknown/invalid API key
    // Integrations: authMiddleware verifies signature; rejects unknown key
    it("rejects invalid API key (P3)", async () => {
      const res = await request(app)
        .post("/api/rank")
        .set("Authorization", "Bearer invalid_key_12345678")
        .send({ project_id: projectId });
      expect([403, 401]).toContain(res.status);
    });
  });
});
