/**
 * tests/theme.test.ts
 *
 * API tests for theme-related endpoints.
 * Covers creation and retrieval of themes for authenticated clients.
 */

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";

describe("Theme API", () => {
  let apiKey: string;

  // Before tests, create a client to get a valid API key
  beforeAll(async () => {
    resetMockTables();

    const res = await request(app)
      .post("/api/clients/create")
      .send({ name: "Theme Test Client" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    apiKey = res.body.data.api_key;
    expect(apiKey).toBeDefined();
  });

  // Test successful theme creation
  it("should create a new theme for authenticated client", async () => {
    const res = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Modern Tech Theme",
        tags: ["modern", "tech", "clean"],
        inspirations: ["Apple", "Google", "Stripe"],
        font: "Roboto",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Theme created successfully");
    expect(res.body.data).toHaveProperty("id");
  });

  // Missing required field (name)
  it("should fail to create a theme with missing name", async () => {
    const res = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        font: "Roboto",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Missing required fields");
  });

  // List all themes for the client
  it("should list all themes for the authenticated client", async () => {
    const res = await request(app)
      .get("/api/themes")
      .set("Authorization", `Bearer ${apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Retrieved themes");
  });

  // Unauthorized access — missing API key
  it("should return 401 when API key is missing", async () => {
    const res = await request(app).get("/api/themes");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
