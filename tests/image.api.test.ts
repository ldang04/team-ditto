/**
 * Equivalence Partitioning Map (API: Images Generation)
 *
 * Inputs under test:
 * - Authorization header (`Bearer <apiKey>`)
 *   - P1 Valid: Proper `Bearer <validKey>` for existing client → 201
 *   - P2 Invalid: Missing header or malformed scheme → 401
 *   - P3 Invalid: Well-formed header but invalid/unknown key → typically 403 (may be 401)
 *   - P4 Boundary: `Bearer ` with empty token → 401 (middleware)
 *   - T3 Atypical: Authorization header with extra spaces between scheme and token → typically invalid
 *
 * - Body: `project_id` and `prompt`
 *   - B1 Valid: Both present; controller checks presence not trim → proceeds
 *   - B2 Invalid: Either missing (null/undefined) → 400
 *   - T1 Atypical: Surrounding/whitespace-only or Unicode prompt → accepted or may 500 downstream
 *
 * - Body: `variantCount` (number of images)
 *   - V1 Valid: Integer within [0, 10] → accepted
 *   - V2 Invalid: Non-integer or out of range (<0 or >10) → 400
 *   - V3 Boundary: 0 and 10 → accepted
 *
 * - Body: `aspectRatio`
 *   - A1 Valid: One of ["1:1", "16:9", "9:16", "4:5", "3:2"] or empty/falsy (coerced to "1:1") → accepted
 *   - A2 Invalid: Any other non-empty value → 400
 *
 * - Not Found
 *   - N1 Invalid: `project_id` does not exist → 404
 */

// Gate any external initialization
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
process.env.RUN_REAL_IMAGE_TESTS = process.env.RUN_REAL_IMAGE_TESTS || "0";

jest.setTimeout(200000);

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

// Mock external services to avoid quota/remote calls
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
    it("handles whitespace-only prompt (P1, B1/T1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "   \t  ", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // Atypical valid (P1, B1/T1 - padded whitespace prompt)
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
    it("accepts Unicode prompt (emoji/non-Latin) (P1, B1/T1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "ポスター🎨", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // VariantCount boundaries (P1, V3 - 0 acceptable)
    it("accepts variantCount = 0 (P1, V3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 0 });
      expect([201]).toContain(res.status);
    });

    // VariantCount boundaries (P1, V3 - 10 acceptable)
    it("accepts variantCount = 10 (P1, V3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 10 });
      expect([201]).toContain(res.status);
    });

    // VariantCount invalid (P1, V2 - -1)
    it("rejects variantCount < 0 (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: -1 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // VariantCount invalid (P1, V2 - 11)
    it("rejects variantCount > 10 (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 11 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // VariantCount invalid (P1, V2 - non-integer)
    it("rejects non-integer variantCount (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: 3.5 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // VariantCount invalid (P1, V2 - non-numeric)
    it("rejects non-numeric variantCount (P1, V2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster", variantCount: "ten" });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid variantCount/);
    });

    // AspectRatio valid (P1, A1)
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
    it("returns 404 when project or theme not found (P1, N1)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: "nonexistent-" + "x".repeat(32),
          prompt: "Poster",
        });
      expect([404]).toContain(res.status);
    });

    // Invalid auth: missing header (P2)
    it("returns 401 when API key missing (P2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .send({ project_id: projectId, prompt: "Poster" });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Invalid auth: malformed scheme (P2)
    it("returns 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearerr ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster" });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Missing API key");
    });

    // Invalid auth: unknown key (P3)
    it("rejects invalid API key (P3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", "Bearer invalid_key_123456")
        .send({ project_id: projectId, prompt: "Poster" });
      expect([403]).toContain(res.status);
    });

    // Boundary: empty token (P4)
    it("returns 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", "Bearer ")
        .send({ project_id: projectId, prompt: "Poster" });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Missing API key");
    });

    // Invalid: extra spaces after Bearer (P3/T3)
    it("rejects Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .post("/api/images/generate")
        .set("Authorization", `Bearer   ${apiKey}`)
        .send({ project_id: projectId, prompt: "Poster" });
      expect([403]).toContain(res.status);
    });

    // Integration (opt-in): real Vertex AI call when RUN_REAL_IMAGE_TESTS=1
    // Partitions: P1 (valid auth), B1 (valid body), V3 (boundary=1), A1 (valid aspect)
    (process.env.RUN_REAL_IMAGE_TESTS === "1" ? it : it.skip)(
      "REAL: calls Vertex AI to generate 1 image (P1, B1, V3=1, A1)",
      async () => {
        const { resetMockTables } = require("../__mocks__/supabase");
        resetMockTables();

        const appReal = await (async () => {
          jest.resetModules();
          process.env.GCP_PROJECT_ID =
            process.env.GCP_PROJECT_ID || "team-ditto";

          // Unmock all related services to perform a true integration run
          jest.unmock("../src/services/ImageGenerationService");
          jest.unmock("../src/services/StorageService");
          jest.unmock("../src/services/EmbeddingService");

          let appMod: any;
          await jest.isolateModulesAsync(async () => {
            appMod = require("../src/app");
          });
          return appMod.default || appMod;
        })();

        // Create client → apiKey
        const createClient = await require("supertest")(appReal)
          .post("/api/clients/create")
          .send({ name: "Real Gen Client" });
        expect(createClient.status).toBe(201);
        const realApiKey = createClient.body.data.api_key;

        // Create project
        const createProject = await require("supertest")(appReal)
          .post("/api/projects/create")
          .set("Authorization", `Bearer ${realApiKey}`)
          .send({ name: "Real Gen Project" });
        expect(createProject.status).toBe(201);
        const realProjectId = createProject.body.data.id;

        // Create theme and link to project
        const createTheme = await require("supertest")(appReal)
          .post("/api/themes/create")
          .set("Authorization", `Bearer ${realApiKey}`)
          .send({
            project_id: realProjectId,
            name: "Real Theme",
            tags: ["modern"],
            inspirations: [],
          });
        expect([201, 200]).toContain(createTheme.status);
        const realThemeId = createTheme.body.data?.id;
        if (realThemeId) {
          const linkTheme = await require("supertest")(appReal)
            .put(`/api/projects/${realProjectId}`)
            .set("Authorization", `Bearer ${realApiKey}`)
            .send({ theme_id: realThemeId });
          expect(linkTheme.status).toBe(200);
        }

        // Invoke real generation with variantCount=1 to minimize quota
        const res = await require("supertest")(appReal)
          .post("/api/images/generate")
          .set("Authorization", `Bearer ${realApiKey}`)
          .send({
            project_id: realProjectId,
            prompt: "Minimal modern poster",
            variantCount: 1,
            aspectRatio: "1:1",
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      }
    );
  });
});
