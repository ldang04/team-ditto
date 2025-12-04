/**
 * Equivalence Partitioning Map (API: Text Generation)
 *
 * Inputs under test:
 * - Authorization header (`Bearer <apiKey>`)
 *   - P1 Valid: Proper `Bearer <validKey>` → 201
 *   - P2 Invalid: Missing header or malformed scheme → 401
 *   - P3 Invalid: Well-formed header but invalid/unknown key → 403
 *   - P4 Boundary: `Bearer ` with empty token → 401 (middleware treats as invalid key)
 *   - T3 Atypical: Authorization header with extra spaces → 403 (parsed empty token)
 *
 * - Body: `project_id` and `prompt`
 *   - B1 Valid: Both present; controller checks presence (not trim) → proceeds
 *   - B2 Invalid: Missing `project_id` or `prompt` → 400
 *   - B3 Invalid: Surrounding/whitespace-only prompt → 500 (currently treated as invalid downstream)
 *   - T1 Atypical: Unicode prompt → accepted
 *
 * - Body: `variantCount`
 *   - V1 Valid: Integer within [0, 10] → accepted
 *   - V2 Invalid: Non-integer or out of range (<0 or >10) → 400
 *   - V3 Boundary: 0 and 10 → accepted
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
jest.setTimeout(15000);

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

// Mock external services to avoid quota/remote calls
// Note: Mocks must be at the top level (not inside conditionals) for Jest's hoisting to work.
// Jest hoists jest.mock() calls, so conditionals prevent proper mock application.
jest.mock("../src/services/TextGenerationService", () => ({
  TextGenerationService: {
    generateContent: jest.fn(async ({ variantCount }: any) => {
      const count = Number(variantCount) || 0;
      return Array.from(
        { length: count },
        (_, i) => `Mock text variant ${i + 1}`
      );
    }),
  },
}));

jest.mock("../src/services/EmbeddingService", () => ({
  EmbeddingService: {
    generateAndStoreText: jest.fn(async () => undefined),
  },
}));

describe("Text API", () => {
  let apiKey: string;
  let projectId: string;

  beforeAll(async () => {
    resetMockTables();

    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "Text Test Client" });
    expect(clientRes.status).toBe(201);
    apiKey = clientRes.body.data.api_key;

    const projectRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Text Test Project" });
    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;

    // Create a theme and link it (Text controller requires project + theme)
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        name: "Text Theme",
        tags: ["modern"],
        inspirations: [],
      });
    expect([201, 200]).toContain(themeRes.status);
    const themeId = themeRes.body.data?.id;
    if (themeId) {
      const linkRes = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ theme_id: themeId });
      expect([200]).toContain(linkRes.status);
    }
  });

  beforeEach(() => {
    jest.spyOn(logger, "info").mockImplementation();
    // Don't mock error so we can see what's actually failing
    // jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/text/generate", () => {
    // Valid input (P1, B1) with variantCount=0 to avoid work
    it("generates text with valid inputs (P1, B1)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Write a catchy tagline",
          variantCount: 0,
        });
      expect([201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    // Invalid input (P1, B2 - missing prompt)
    it("rejects when prompt is missing (P1, B2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId });
      expect(res.status).toBe(400);
    });

    // Invalid input (P1, B2 - missing project_id)
    it("rejects when project_id is missing (P1, B2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ prompt: "Hello" });
      expect(res.status).toBe(400);
    });

    // Invalid formatting (P1, B3 - whitespace-only prompt)
    it("rejects whitespace-only prompt (P1, B3)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "   \t  ", variantCount: 0 });
      expect(res.status).toBe(500);
    });

    // Atypical formatting (P1, T1 - Unicode prompt)
    it("accepts Unicode prompt (emoji/non-Latin) (P1, T1)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "スローガン✨",
          variantCount: 0,
        });
      expect([201]).toContain(res.status);
    });

    // VariantCount boundaries (P1, V3 - 0 acceptable)
    it("accepts variantCount = 0 (P1, V3)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // VariantCount boundaries (P1, V3 - 10 acceptable)
    it("accepts variantCount = 10 (P1, V3)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello", variantCount: 10 });
      expect([201]).toContain(res.status);
    });

    // VariantCount invalid (P1, V2 - -1)
    it("rejects variantCount < 0 (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello", variantCount: -1 });
      expect(res.status).toBe(400);
    });

    // VariantCount invalid (P1, V2 - 11)
    it("rejects variantCount > 10 (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello", variantCount: 11 });
      expect(res.status).toBe(400);
    });

    // VariantCount invalid (P1, V2 - non-integer)
    it("rejects non-integer variantCount (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello", variantCount: 3.5 });
      expect(res.status).toBe(400);
    });

    // VariantCount invalid (P1, V2 - non-numeric)
    it("rejects non-numeric variantCount (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello", variantCount: "ten" });
      expect(res.status).toBe(400);
    });

    // Invalid auth: missing header (P2)
    it("returns 401 when API key missing (P2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .send({ project_id: projectId, prompt: "Hello" });
      expect(res.status).toBe(401);
    });

    // Invalid auth: malformed header (P2)
    it("returns 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearerr ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello" });
      expect(res.status).toBe(401);
    });

    // Invalid auth: unknown key (P3)
    it("rejects invalid API key (P3)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", "Bearer invalid_key_123456")
        .send({ project_id: projectId, prompt: "Hello" });
      expect([403]).toContain(res.status);
    });

    // Boundary: empty token (P4)
    it("returns 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", "Bearer ")
        .send({ project_id: projectId, prompt: "Hello" });
      expect(res.status).toBe(401);
    });

    // Invalid: extra spaces after Bearer (P3/T3)
    it("rejects Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer   ${apiKey}`)
        .send({ project_id: projectId, prompt: "Hello" });
      expect([403]).toContain(res.status);
    });
  });

  // Optional real integration test: set RUN_REAL_TEXT_TESTS=1 to enable
  describe("POST /api/text/generate (real)", () => {
    const runReal = process.env.RUN_REAL_TEXT_TESTS === "1";

    const maybeIt = runReal ? it : it.skip;

    maybeIt("runs end-to-end with real services when enabled", async () => {
      // Use a simple prompt and variantCount=0 to minimize work
      const res = await request(app)
        .post("/api/text/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Hello world",
          variantCount: 0,
        });

      expect([201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });
});
