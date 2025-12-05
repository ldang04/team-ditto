/**
 * Integration Scope + Equivalence Partitions (API: Image Generation)
 *
 * Internal integrations exercised by these tests:
 * - `routes/image.routes.ts` → `ImageGenerationController` (generate)
 * - `authMiddleware` for API key validation and client binding
 * - `ProjectController`/`ProjectService` for project creation and linking theme prerequisite
 * - `ThemeController`/`ThemeService` to associate a theme with the project
 * - `ImageGenerationService` (mocked) for generating image data
 * - `StorageService` (mocked) for uploading images and returning public URLs
 * - `EmbeddingService` (mocked) for storing image embeddings
 * - `supabaseClient` (mocked) for DB-backed entities; `resetMockTables()` controls shared state
 * - `logger` (`info`/`error`) instrumentation across middleware and controllers
 *
 * External integrations: none by default (all services mocked).
 *
 * Equivalence Partitions
 * - Authorization header `Bearer <apiKey>`
 *   - P1 Valid: Proper `Bearer <validKey>` for existing client → 201
 *   - P2 Invalid: Missing or malformed scheme → 401
 *   - P3 Invalid: Well-formed but unknown/invalid key → typically 403
 *   - P4 Boundary: `Bearer ` empty token → 401
 *   - T3 Atypical: Extra spaces after `Bearer` → typically 403
 *
 * - Body: `project_id`, `prompt`
 *   - B1 Valid: Both present (controller checks presence, not trim) → proceeds
 *   - B2 Invalid: Either missing → 400
 *   - T1 Atypical: Surrounding whitespace or Unicode prompt → accepted; whitespace-only still considered present here
 *
 * - Body: `variantCount`
 *   - V1 Valid: Integer within [0, 10] → accepted
 *   - V2 Invalid: Non-integer or out of range (<0 or >10) → 400
 *   - V3 Boundary: 0 and 10 → accepted
 *
 * - Body: `aspectRatio`
 *   - A1 Valid: One of ["1:1", "16:9", "10:16", "4:5", "3:2"] or empty/falsy (defaults to "1:1") → accepted
 *   - A2 Invalid: Any other non-empty value → 400
 *
 * - Not Found
 *   - N1 Invalid: `project_id` not found → 404
 */

// Gate any external initialization
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

jest.setTimeout(200000);

// Mock external services to avoid quota/remote calls unless explicitly disabled
jest.mock("../src/services/ImageGenerationService", () => ({
  ImageGenerationService: {
    generateImages: jest.fn(async ({ numberOfImages }: any) => {
      const count = Number(numberOfImages) || 0;
      return Array.from({ length: count }, (_, i) => ({
        imageData: `data://fake-image-${i}`,
        mimeType: "image/png",
        seed: 12345 + i,
      }));
    }),
  },
}));

jest.mock("../src/services/StorageService", () => ({
  StorageService: {
    uploadImage: jest.fn(async () => "https://example.com/fake.png"),
  },
}));

jest.mock("../src/services/EmbeddingService", () => ({
  EmbeddingService: {
    generateAndStoreImage: jest.fn(async () => undefined),
  },
}));

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

describe("Image API", () => {
  let apiKey: string;
  let projectId: string;

  beforeAll(async () => {
    resetMockTables();

    // Create client (to get API key)
    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "Image Test Client" });
    expect(clientRes.status).toBe(201);
    apiKey = clientRes.body.data.api_key;

    // Create a project for image generation
    const projectRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ name: "Image Test Project" });
    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;
    expect(projectId).toBeDefined();

    // Create a theme for the project so generation can succeed
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        name: "Default Theme",
        tags: ["modern", "minimalist"],
        inspirations: ["bauhaus", "flat design"],
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
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/images/generate", () => {
    // Valid input (P1, B1, V1/A1 default) → 201
    // Integrations: authMiddleware (P1), ImageGenerationController.generate, ImageGenerationService (mock), StorageService (mock), EmbeddingService (mock), logger.info
    it("generates images with valid inputs (P1, B1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "A modern minimalist poster",
          variantCount: 0,
        });
      expect(logger.info).toHaveBeenCalled();
      expect([201]).toContain(res.status);
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/Images generated successfully/);
      } else {
        expect(res.body.success).toBe(false);
      }
    });

    // Invalid input (P1, B2 - missing prompt)
    // Integrations: controller validation rejects; services not invoked; logger.error
    it("rejects when prompt is missing (P1, B2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Missing required fields/);
    });

    // Invalid input (P1, B2 - missing project_id)
    // Integrations: controller validation rejects; logger.error
    it("rejects when project_id is missing (P1, B2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ prompt: "A poster" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Missing required fields/);
    });

    // Atypical formatting (P1, B1/T1 - whitespace-only, treated as present)
    // Integrations: presence check allows; services run with mocked data; logger.info
    it("handles whitespace-only prompt (P1, B1/T1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "   \t  ", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // Atypical valid (P1, B1/T1 - padded whitespace prompt)
    // Integrations: presence check; services run; logger.info
    it("accepts prompt with surrounding whitespace (P1, B1/T1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "  Modern art poster  \n",
          variantCount: 0,
        });
      expect([201]).toContain(res.status);
    });

    // Atypical valid (P1, B1/T1 - Unicode prompt)
    // Integrations: Unicode prompt accepted; services run; logger.info
    it("accepts Unicode prompt (emoji/non-Latin) (P1, B1/T1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "ポスター🎨", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // VariantCount boundaries (P1, V3 - 0 acceptable)
    // Integrations: controller validates boundaries; mocked services return []; logger.info
    it("accepts variantCount = 0 (P1, V3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // VariantCount boundaries (P1, V3 - 10 acceptable)
    // Integrations: boundary max accepted; ImageGenerationService mock returns 10; StorageService mock uploads; logger.info
    it("accepts variantCount = 10 (P1, V3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 10 });
      expect([201]).toContain(res.status);
    });

    // VariantCount invalid (P1, V2 - -1)
    // Integrations: controller rejects out-of-range; logger.error
    it("rejects variantCount < 0 (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: -1 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // VariantCount invalid (P1, V2 - 11)
    // Integrations: controller rejects out-of-range; logger.error
    it("rejects variantCount > 10 (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 11 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // VariantCount invalid (P1, V2 - non-integer)
    // Integrations: controller enforces integer; rejects float; logger.error
    it("rejects non-integer variantCount (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 3.5 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // VariantCount invalid (P1, V2 - non-numeric)
    // Integrations: controller type-checks; rejects string; logger.error
    it("rejects non-numeric variantCount (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: "ten" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // AspectRatio valid (P1, A1)
    // Integrations: controller validates aspect ratios; defaults to 1:1 when empty; services run; logger.info
    it("accepts allowed aspectRatio (P1, A1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Poster",
          aspectRatio: "16:9",
          variantCount: 0,
        });
      expect([201]).toContain(res.status);
    });

    // AspectRatio invalid (P1, A2)
    // Integrations: controller rejects invalid aspect ratio; logger.error
    it("rejects invalid aspectRatio (P1, A2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Poster",
          aspectRatio: "2:1",
          variantCount: 0,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid aspectRatio/);
    });

    // AspectRatio invalid empty (P1, A2)
    // Integrations: empty aspect treated as default; services run; logger.info
    it("treats empty aspectRatio as default 1:1 (P1, A1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: projectId,
          prompt: "Poster",
          aspectRatio: "",
          variantCount: 0,
        });
      expect([201]).toContain(res.status);
    });

    // Not Found project (P1, N1)
    // Integrations: controller checks project existence or linked theme; returns 404; logger.error
    it("returns 404 when project or theme not found (P1, N1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: "nonexistent-" + "x".repeat(32),
          prompt: "Poster",
          variantCount: 0,
        });
      expect([404]).toContain(res.status);
    });

    // Invalid auth: missing header (P2)
    // Integrations: authMiddleware rejects; controller short-circuits; logger.error
    it("returns 401 when API key missing (P2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .send({ project_id: projectId, prompt: "Poster" });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Invalid auth: malformed scheme (P2)
    // Integrations: authMiddleware rejects wrong scheme; controller not invoked; logger.error
    it("returns 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearerr ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster" });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Missing API key");
    });

    // Invalid auth: unknown key (P3)
    // Integrations: authMiddleware verifies signature; rejects unknown key; logger.error
    it("rejects invalid API key (P3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", "Bearer invalid_key_123456")
        .send({ project_id: projectId, prompt: "Poster" });
      expect([403]).toContain(res.status);
    });

    // Boundary: empty token (P4)
    // Integrations: empty token treated as missing; logger.error
    it("returns 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", "Bearer ")
        .send({ project_id: projectId, prompt: "Poster" });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Missing API key");
    });

    // Invalid: extra spaces after Bearer (P3/T3)
    // Integrations: header parsing fails with extra spaces; logger.error
    it("rejects Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer   ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster" });
      expect([403]).toContain(res.status);
    });
  });
});
