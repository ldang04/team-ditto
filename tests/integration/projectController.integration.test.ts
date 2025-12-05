/**
 * Project Controller — Integration Tests (no mocks)
 *
 * Integrates:
 * - Express app (`src/app.ts`) with real routes and auth middleware.
 * - ProjectController.create, listByClient, update via real Supabase DB.
 * - Auth middleware: validates `Authorization: Bearer <api_key>`.
 *
 * External:
 * - Supabase DB for project persistence, read, and updates.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import request from "supertest";
import { supabase } from "../../src/config/supabaseClient";
import app from "../../src/app";

describe("Project Controller Integration", () => {
  jest.setTimeout(15000);
  let apiKey: string | undefined;
  let clientId: string | undefined;
  let projectId: string | undefined;

  /**
   * Integrates: ClientController.create and auth binding.
   * External: Supabase DB writes; middleware issues API key and binds clientId.
   * Validates: we obtain a working API key to use for subsequent project operations.
   */
  beforeAll(async () => {
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "ProjectCtrl Int Client" });
    expect([200, 201]).toContain(clientRes.status);
    apiKey = clientRes.body?.data?.api_key;
    clientId = clientRes.body?.data?.client_id;
    expect(typeof apiKey).toBe("string");
    expect(typeof clientId).toBe("string");
  });

  /**
   * Integrates: Routing → Auth middleware → ProjectController.create.
   * External: Supabase DB insert with client_id binding.
   * Validates: valid name creates project and returns 201 with project id and fields.
   */
  it("creates a project with valid name", async () => {
    const res = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Test Project Alpha" });

    expect([200, 201]).toContain(res.status);
    expect(res.body?.data?.id).toBeTruthy();
    expect(res.body?.data?.name).toBe("Test Project Alpha");
    expect(res.body?.data?.client_id).toBe(clientId);
    expect(res.body?.message).toMatch(/created successfully/i);
    projectId = res.body?.data?.id;
  });

  /**
   * Integrates: Input validation branch for missing/empty name.
   * External: Controller returns 400 before DB insert.
   * Validates: empty or missing name is rejected.
   */
  it("rejects project creation with empty name", async () => {
    const res = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body?.message).toMatch(/Missing required fields/i);
  });

  /**
   * Integrates: Auth middleware rejection (missing Authorization header).
   * External: Controller not reached.
   * Validates: missing Authorization yields 401.
   */
  it("rejects project creation when Authorization is missing", async () => {
    const res = await request(app)
      .post("/api/projects/create")
      .send({ name: "No Auth Project" });

    expect(res.status).toBe(401);
  });

  /**
   * Integrates: Routing → Auth middleware → ProjectController.listByClient.
   * External: Supabase DB read filtering by authenticated client_id.
   * Validates: lists all projects for the client; may be empty if none exist.
   */
  it("lists projects for the authenticated client", async () => {
    const res = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${apiKey}`);

    expect([200, 204]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body?.data)).toBe(true);
    }
  });

  /**
   * Integrates: Auth middleware rejection (malformed Authorization).
   * External: Controller not reached.
   * Validates: non-Bearer Authorization format yields 401.
   */
  it("rejects list request with malformed Authorization", async () => {
    const res = await request(app)
      .get("/api/projects")
      .set("Authorization", apiKey as string);

    expect(res.status).toBe(401);
  });

  /**
   * Integrates: Routing → Auth middleware → ProjectController.update.
   * External: Supabase DB update by project id.
   * Validates: project fields can be updated; returns updated record.
   */
  it("updates an existing project", async () => {
    if (!projectId) {
      return;
    }
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Updated Project Name", description: "New description" });

    expect([200, 201]).toContain(res.status);
    expect(res.body?.data?.id).toBe(projectId);
    expect(res.body?.data?.name).toBe("Updated Project Name");
    expect(res.body?.message).toMatch(/Updated project successfully/i);
  });

  /**
   * Integrates: Missing project id in path.
   * External: Controller validation returns 400.
   * Validates: missing id path param is rejected.
   */
  it("rejects update when project id is missing from path", async () => {
    const res = await request(app)
      .put("/api/projects/")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Updated" });

    expect(res.status).toBe(404);
  });

  /**
   * Integrates: Project id path lookup failure.
   * External: Supabase DB query for non-existent id.
   * Validates: unknown project id returns error.
   */
  it("returns error when updating non-existent project", async () => {
    const res = await request(app)
      .put("/api/projects/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Ghost Project" });

    expect([400, 404, 500]).toContain(res.status);
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
    if (clientId) {
      await supabase.from("clients").delete().eq("id", clientId);
    }
  });
});
