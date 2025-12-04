/**
 * Integration Scope + Equivalence Partitions (API: Themes)
 *
 * Internal integrations exercised by these tests:
 * - `routes/theme.routes.ts` → `ThemeController` (create/list)
 * - `authMiddleware` for API key validation and request binding
 * - `ThemeService` business rules: field normalization, validation, persistence
 * - `supabaseClient` (mocked) for storage/DB table ops; `resetMockTables()` controls shared state
 * - `logger` (`info`/`error`) instrumentation across middleware and controllers
 *
 * Shared test data and isolation notes:
 * - A client is created once in `beforeAll` to obtain `apiKey`; all requests bind to that client.
 * - `resetMockTables()` is called prior to client creation to ensure clean tables; themes created in tests
 *   are visible to subsequent list calls for the same client only.
 * - No cross-client contamination is exercised here; invalid/unknown keys simulate a different client context.
 *
 * Equivalence Partitioning Map
 * - Authorization header (`Bearer <apiKey>`)
 *   - P1 Valid: Proper `Bearer <validKey>` → 200/201
 *   - P2 Invalid: Missing/malformed header → 401
 *   - P3 Invalid: Well-formed header but invalid/unknown key → typically 403
 *   - P4 Boundary: `Bearer ` with empty token → 401
 *   - P5 Atypical: Extra spaces or mixed case → typically invalid (403); parsing may vary
 *
 * - Create body (`name`, `tags`, optional `inspirations`)
 *   - C1 Valid: `name` non-empty trimmed AND `tags` non-empty array → 201
 *   - C2 Invalid: Missing/empty/whitespace `name` OR `tags` missing/not array/empty → 400
 *   - C3 Boundary: Minimal name "a" with valid `tags` → 201
 *   - C4 Atypical: Very long/Unicode `name` with valid `tags` → 201
 *   - C5 Atypical: `inspirations` missing or not array → normalized to [] (still 201)
 *
 * - Atypical normalization/formatting (T-partitions)
 *   - T1: Surrounding whitespace in fields (trim to valid if non-empty)
 *   - T2: Unicode/non-Latin/emoji in `name` → accepted
 *   - T3: Authorization header with extra spaces between scheme and token
 */

// Ensure external services safely gated on import
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

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

  beforeEach(() => {
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/themes/create", () => {
    // Valid (P1, C1)
    // Integrations: authMiddleware (P1), ThemeController.create, ThemeService.create, supabaseClient (mock), logger.info
    // Shared data: binds to `apiKey` client; created theme persists for that client
    it("should create a new theme for authenticated client (P1, C1)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          name: "Modern Tech Theme",
          tags: ["modern", "tech", "clean"],
          inspirations: ["Apple", "Google", "Stripe"],
          font: "Roboto",
        });

      expect(logger.info).toHaveBeenCalled();
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Theme created successfully");
      expect(res.body.data).toHaveProperty("id");
    });

    // Invalid (P1, C2) — missing name
    // Integrations: authMiddleware (P1), ThemeController.create validation branch, ThemeService rejects, logger.info
    // Shared data: none created; prior client state unchanged
    it("should fail to create a theme with missing name (P1, C2)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          font: "Roboto",
        });

      expect(logger.info).toHaveBeenCalled();
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Missing required fields");
    });

    // Boundary (P1, C3) — minimal name with valid tags
    // Integrations: authMiddleware (P1), ThemeController.create, normalization path; supabaseClient insert
    // Shared data: persists minimal-name theme for client; visible to later list
    it("should create with minimal boundary name 'a' (P1, C3)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "a", tags: ["minimal"] });
      expect(res.status).toBe(201);
    });

    // Invalid (P1, C2) — whitespace-only name
    // Integrations: ThemeController.create validation trim → invalid, logger.error likely
    // Shared data: none created
    it("should reject whitespace-only name (P1, C2)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "   \t  " });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Missing required fields");
    });

    // Atypical valid (P1, C1/T1) — padded whitespace name trims to valid (requires tags)
    // Integrations: normalization trims name (T1) then valid create; supabaseClient insert; logger.info
    // Shared data: persists trimmed-name theme for client
    it("should accept name with surrounding whitespace (P1, C1/T1)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "  🚀 Modern Tech  ", tags: ["modern"] });
      expect([201]).toContain(res.status);
    });

    // Atypical valid (P1, C1/T2) — Unicode/non-Latin/emoji name (requires tags)
    // Integrations: Unicode handling in validation (T2); ThemeService allows; supabase insert; logger.info
    // Shared data: persists Unicode theme for client
    it("should accept Unicode name (emoji/non-Latin) (P1, C1/T2)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "テーマ✨", tags: ["modern"] });
      expect([201]).toContain(res.status);
    });

    // Atypical valid (P1, C4) — very long name (requires tags)
    // Integrations: length-agnostic acceptance (C4); storage/db insert; logger.info
    // Shared data: persists long-name theme for client
    it("should accept very long name (P1, C4)", async () => {
      const longName = "Theme-" + "x".repeat(500);
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: longName, tags: ["long"] });
      expect([201]).toContain(res.status);
    });

    // Invalid (P1, C2) — missing tags array
    // Integrations: ThemeController.create validates tags; rejects; logger.error
    // Shared data: none created
    it("should reject when tags are missing (P1, C2)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "No Tags" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    // Atypical valid (P1, C5) — inspirations missing or not array is normalized to []
    // Integrations: ThemeService normalizes `inspirations` → [] (C5); supabase insert; logger.info
    // Shared data: persists theme with normalized inspirations
    it("should accept missing or non-array inspirations (P1, C5)", async () => {
      const res = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "No Insp", tags: ["modern"], inspirations: "not-array" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    // Invalid (P1, C2) — tags not array or empty
    // Integrations: validation for `tags` emptiness/type; rejects; logger.error
    // Shared data: none created across looped cases
    it("should reject when tags are empty or not array (P1, C2)", async () => {
      const cases = [
        { name: "Empty Tags", tags: [] },
        { name: "Tags Not Array", tags: "modern" },
      ];
      for (const body of cases) {
        const res = await request(app)
          .post("/api/themes/create")
          .set("Authorization", `Bearer ${apiKey}`)
          .send(body);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe("GET /api/themes", () => {
    // Valid (P1)
    // Integrations: authMiddleware (P1), ThemeController.list, supabaseClient query for bound client, logger.info
    // Shared data: returns only themes created for `apiKey` client in prior tests
    it("should list all themes for the authenticated client (P1)", async () => {
      const res = await request(app)
        .get("/api/themes")
        .set("Authorization", `Bearer ${apiKey}`);

      expect(logger.info).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Retrieved themes");
    });

    // Invalid (P2) missing header
    // Integrations: authMiddleware rejects missing header; controller not invoked; logger.error
    // Shared data: none
    it("should return 401 when API key is missing (P2)", async () => {
      const res = await request(app).get("/api/themes");

      expect(logger.error).toHaveBeenCalled();
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Invalid (P2) malformed header
    // Integrations: authMiddleware rejects malformed scheme; controller not invoked; logger.error
    // Shared data: none
    it("should return 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .get("/api/themes")
        .set("Authorization", `Bearerr ${apiKey}`); // wrong scheme
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Invalid (P3) — unknown/invalid key (typically 403)
    // Integrations: authMiddleware verifies signature and rejects unknown key; controller may short-circuit; logger.error
    // Shared data: simulates different client context; no access to prior themes
    it("should return 403 for invalid API key (P3)", async () => {
      const res = await request(app)
        .get("/api/themes")
        .set("Authorization", `Bearer invalid_key_12345678`);
      expect([403]).toContain(res.status);
    });

    // Boundary (P4) empty token
    // Integrations: authMiddleware treats empty token as missing; logger.error
    // Shared data: none
    it("should return 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .get("/api/themes")
        .set("Authorization", "Bearer ");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Invalid (P3/T3) — Authorization with extra spaces (typically 403)
    // Integrations: header parsing with extra spaces (T3) typically invalid; logger.error
    // Shared data: none
    it("should reject Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .get("/api/themes")
        .set("Authorization", `Bearer   ${apiKey}`);
      expect([403]).toContain(res.status);
    });
  });
});
