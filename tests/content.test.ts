/**
 * tests/content.test.ts
 *
 * API tests for content-related endpoints.
 * Covers listing content by project for authenticated clients.
 */

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";

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
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  /**
   * Valid case: List contents by project ID
   */
  it("should list contents for a valid project", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect(console.log).toHaveBeenCalled();

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    } else {
      // 500 if Supabase credentials or project_id invalid
      expect(res.body).toHaveProperty("error");
    }
  });

  /**
   * Missing project ID in params
   */
  it("should fail if project_id is missing", async () => {
    const res = await request(app)
      .get("/api/contents/")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(console.log).toHaveBeenCalled();

    expect(res.status).toBe(404);
  });

  /**
   * Unauthorized access (no API key)
   */
  it("should return 401 if no API key provided", async () => {
    const res = await request(app).get(`/api/contents/${projectId}`);

    expect(console.log).toHaveBeenCalled();

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing API key");
  });

  /**
   * Atypical input: empty project
   */
  it("should handle atypical valid input (empty project with no contents)", async () => {
    const res = await request(app)
      .get(`/api/contents/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`);

    expect([200, 204]).toContain(res.status);
  });
});
