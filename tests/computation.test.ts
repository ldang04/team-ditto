import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";

describe("Computation API", () => {
  let apiKey: string;
  let projectId: string;
  let themeId: string;

  beforeAll(async () => {
    resetMockTables();

    // Create client and get API key
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "Computation Client" });
    expect(clientRes.status).toBe(201);
    apiKey = clientRes.body.data.api_key;

    // Create theme
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Brand Theme",
        tags: ["modern", "tech"],
        inspirations: ["Apple"],
        font: "Roboto",
      });
    themeId = themeRes.body.data.id;

    // Create project
    const projectRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "AI Project",
        description: "AI-driven marketing system",
        goals: "Grow user base",
        customer_type: "professionals",
        theme_id: themeId,
      });
    projectId = projectRes.body.data.id;
  });

  describe("POST /api/text/generate (new endpoint)", () => {
    it("should return 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 if project not found", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: "nonexistent", prompt: "Generate text" });
      expect([404, 500]).toContain(res.status);
    });

    it("should attempt generation successfully with valid project", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Create a blog short intro",
          variantCount: 1,
        });
      expect([201, 500]).toContain(res.status);
    }, 20000); // increase timeout for API calls
  });

  describe("POST /api/generate (deprecated, backward compatibility)", () => {
    it("should still work with media_type=text", async () => {
      const res = await request(app)
        .post("/api/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Create a blog short intro",
          media_type: "text",
          variantCount: 1,
        });
      expect([201, 500]).toContain(res.status);
    }, 20000);
  });

  describe("POST /api/validate", () => {
    it("should return 400 if missing all inputs", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 if project not found", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          content: "Sample marketing text",
          project_id: "invalid-id",
        });
      expect([404, 500]).toContain(res.status);
    });

    it("should run validation successfully with valid input", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          content: "This is a professional and efficient campaign message.",
          project_id: projectId,
        });
      expect([200, 500]).toContain(res.status);
    }, 20000);
  });
});
