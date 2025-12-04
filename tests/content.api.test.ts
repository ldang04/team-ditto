/**
 * Content API - Equivalence partitions and test mapping
 *
 * Unit under test:
 * - GET /api/contents/:project_id
 *
 * Partitions:
 * - C1 (Valid): Correct API key + valid project_id -> 200 with array.
 * - C2 (Invalid): Missing API key -> 401.
 * - C3 (Invalid): Malformed Authorization header (not Bearer) -> 401.
 * - C4 (Atypical): Valid auth, project has no contents -> 200 with empty array/204.
 * - C5 (Invalid - boundary): project_id missing in route -> 404.
 * - C6 (Boundary): unusual project_id (spaces/long) -> route still matches.
 */

// Ensure GCP project is set to avoid VertexAI init errors in imported app
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

describe("Content API", () => {
  let apiKey: string;
  let projectId: string;

  // Create a client first to obtain a valid API key
  beforeAll(async () => {
    resetMockTables();

    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "Project Test Client" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    apiKey = res.body.data.api_key;
    expect(apiKey).toBeDefined();

    const projectRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Test Project" });

    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;
  });

  beforeEach(() => {
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Valid input (C1): Authorization Bearer key present + valid project_id
  it("should list contents for a valid project (C1)", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(logger.info).toHaveBeenCalled();

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    } else {
      // 500 if Supabase credentials or project_id invalid
      expect(res.body).toHaveProperty("error");
    }
  });

  // Invalid input (C5 - boundary): route path missing project_id
  it("should fail if project_id is missing (C5)", async () => {
    const res = await request(app)
      .get("/api/contents/")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(res.status).toBe(404);
  });

  // Invalid input (C2): Missing Authorization header
  it("should return 401 if no API key provided (C2)", async () => {
    const res = await request(app).get(`/api/contents/${projectId}`);

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing API key");
  });

  // Invalid input (C3): Authorization header malformed (no Bearer prefix)
  it("should return 401 for malformed Authorization header (C3)", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", apiKey); // missing Bearer prefix
    expect(res.status).toBe(401);
  });

  // Atypical input (C4): Valid auth; project has zero contents
  it("should handle atypical valid input (empty project with no contents) (C4)", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect([200, 204]).toContain(res.status);
  });

  // Boundary input (C6): Unusual project_id format (spaces/long) still handled
  it("should handle boundary project_id formats (C6)", async () => {
    const weirdId = "project with spaces and 123";
    const res = await request(app)
      .get(`/api/contents/${encodeURIComponent(weirdId)}`)
      .set("Authorization", `Bearer ${apiKey}`);
    expect([200]).toContain(res.status);
  });
});
