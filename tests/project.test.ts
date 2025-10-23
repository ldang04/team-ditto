/**
 * tests/project.test.ts
 *
 * API tests for project-related endpoints.
 */

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";

jest.setTimeout(20000);

describe("Project API", () => {
  let apiKey: string;
  let projectId: string;

  // Before tests, create a client to get a valid API key
  beforeAll(async () => {
    resetMockTables();

    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "Project Test Client" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    apiKey = res.body.data.api_key;
    expect(apiKey).toBeDefined();
  });

  /**
   * Create Project
   */
  it("should create a new project for authenticated client", async () => {
    const res = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Marketing Champaign",
        description: "A test campaign for our new product launch",
        goals: "Increase brand awareness and drive sales",
        customer_type: "tech-savvy professionals",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Project created successfully");
    expect(res.body.data).toHaveProperty("id");

    projectId = res.body.data.id;
  });

  /**
   * Create Project - Missing Required Fields
   */
  it("should fail to create a project when name is missing", async () => {
    const res = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        description: "No name here",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing required fields");
  });

  /**
   * List All Projects
   */
  it("should list all projects for the authenticated client", async () => {
    const res = await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Retrieved projects");
  });

  /**
   * Unauthorized Project Listing
   */
  it("should return 401 if no API key is provided", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  /**
   * Update Project
   */
  it("should update an existing project", async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Updated Project Name",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Updated project successfully");
    expect(res.body.data.name).toBe("Updated Project Name");
  });

  /**
   * Update Project - Missing ID
   */
  it("should return 404 when trying to update without project ID", async () => {
    const res = await request(app)
      .put("/api/projects/")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Invalid Project Update",
      });

    expect(res.status).toBe(404);
  });
});
