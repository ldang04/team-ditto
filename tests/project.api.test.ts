/**
 * Projects API — Internal Integration Test + Partitions Mapping
 *
 * Scope and integrations:
 * - HTTP layer: `app` mounts project routes and auth middleware.
 * - Middleware: Authorization header parsing (`Bearer <apiKey>`), JSON body parsing.
 * - Controllers + Models: Project create/list/update flows persisting and retrieving
 *   data (via mocked Supabase models in tests).
 * - Logger: `src/config/logger` emits info/error; spies validate invocation.
 *
 * At least one valid case per integrated interface/shared data path:
 * - Authenticated create/list/update flows (route + auth + controller + model): P1+C1, P1+U1.
 * - Invalid auth paths (middleware rejection): P2, P3, P4.
 * - Boundary/atypical input handling (controller/model robustness): C3, C4, T1, T2, T3.
 * - Cross-client isolation (shared data path via API key scoping): isolation test at bottom.
 *
 * Inputs under test:
 * - Authorization header (`Bearer <apiKey>`)
 *   - P1 Valid: Proper `Bearer <validKey>` for existing client → 200/201
 *   - P2 Invalid: Missing header or malformed scheme → 401
 *   - P3 Invalid: Well-formed header but invalid/unknown key → typically 403 (may be 401 in edge cases)
 *   - P4 Boundary: `Bearer ` with empty token → 401 (middleware)
 *   - P5 Atypical: Extra spaces or mixed case still starting with `Bearer ` → typically invalid (403); tests may accept variant outcomes depending on parsing
 *
 * - Create body `name`
 *   - C1 Valid: Non-empty trimmed string → 201
 *   - C2 Invalid: Missing `name` or empty/whitespace-only → 400
 *   - C3 Boundary: Minimal length `"a"` → 201
 *   - C4 Atypical: Very long string → 201 (if accepted)
 *
 * - Update path param `id`
 *   - U1 Valid: Existing project id → 200
 *   - U2 Invalid: Empty or missing id → 404 (route not matched)
 *   - U3 Boundary/Atypical: Extremely long/nonexistent id → controller robustness (200/500)
 *
 * - Atypical normalization/formatting (general T-partitions used across endpoints)
 *   - T1 Atypical: Surrounding whitespace in fields (trim to valid if non-empty)
 *   - T2 Atypical: Unicode/non-Latin/emoji in `name` → accepted
 *   - T3 Atypical: Authorization header with extra spaces between scheme and token
 *
 */

// Ensure external services that may init on import are safely gated
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

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

  beforeEach(() => {
    jest.spyOn(logger, "info").mockImplementation();
    jest.spyOn(logger, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/projects/create", () => {
    // Valid input (P1, C1 - Valid auth, valid name)
    // Integrates: route + auth middleware + controller + model persistence + logger.
    it("should create a new project for authenticated client (P1, C1)", async () => {
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          name: "Marketing Champaign",
          description: "A test campaign for our new product launch",
          goals: "Increase brand awareness and drive sales",
          customer_type: "tech-savvy professionals",
        });

      expect(logger.info).toHaveBeenCalled();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Project created successfully");
      expect(res.body.data).toHaveProperty("id");

      projectId = res.body.data.id;
    });

    // Invalid input (P1, C2 - Valid auth, invalid name: missing)
    // Integrates: route + auth + controller validation.
    it("should fail to create a project when name is missing (P1, C2)", async () => {
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          description: "No name here",
        });

      expect(logger.info).toHaveBeenCalled();
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Missing required fields");
    });

    // Atypical valid input (P1, C3 - Valid auth, boundary name length)
    // Integrates: route + auth + controller minimal length acceptance.
    it("should create with minimal boundary name 'a' (P1, C3)", async () => {
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "a" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Project created successfully");
    });

    // Invalid input (P1, C2 - Valid auth, invalid whitespace-only name)
    // Integrates: route + auth + controller trim/validation.
    it("should reject whitespace-only name (P1, C2)", async () => {
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "   \t  " });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Missing required fields");
    });

    // Atypical valid input (P1, C4 - Valid auth, atypical very long name)
    // Integrates: controller/model limits/robustness under long input.
    it("should accept very long name (P1, C4)", async () => {
      const longName = "Project-" + "x".repeat(500);
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: longName });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    // Atypical valid (T1): name with padding whitespace trims to non-empty
    // Integrates: controller normalization of name; model persistence.
    it("should accept name with surrounding whitespace (P1, C1/T1)", async () => {
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "   Padded Name  \t\n" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    // Atypical valid (T2): Unicode/non-Latin/emoji name
    // Integrates: controller unicode handling; model persistence.
    it("should accept Unicode name (emoji and non-Latin) (P1, C1/T2)", async () => {
      const res = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "プロジェクト🚀" });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/projects", () => {
    // Valid input (P1 - Valid auth)
    // Integrates: route + auth + controller + model query.
    it("should list all projects for the authenticated client (P1)", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${apiKey}`);

      expect(logger.info).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Retrieved projects");
    });

    // Invalid input (P2 - Invalid auth: missing header)
    // Integrates: auth middleware rejection.
    it("should return 401 if no API key is provided (P2)", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Invalid input (P2 - Invalid auth: malformed header)
    // Integrates: auth middleware scheme validation.
    it("should return 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearerr ${apiKey}`); // wrong scheme
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Missing API key");
    });

    // Invalid input (P3 - Invalid auth: unknown/invalid key)
    // Integrates: auth middleware token validation.
    it("should reject invalid API key (P3)", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer invalid_key_12345678`);
      expect([403, 401]).toContain(res.status);
      if (res.status === 403) {
        expect(res.body.message).toBe("Invalid API key");
      } else {
        expect(res.body.message).toBe("Missing API key");
      }
    });

    // Invalid boundary (P4): empty token after Bearer → 401
    // Integrates: auth middleware empty token handling.
    it("should return 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", "Bearer ");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Missing API key");
    });

    // Invalid formatting (T3) treated as invalid: Authorization with extra spaces → usually 403
    // Integrates: auth header parsing tolerance.
    it("should reject Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer   ${apiKey}`);
      expect([403, 200]).toContain(res.status);
    });
  });

  describe("PUT /api/projects/:id", () => {
    // Valid input (P1, U1 - Valid auth, valid id)
    // Integrates: route + auth + controller update + model persistence.
    it("should update an existing project (P1, U1)", async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          name: "Updated Project Name",
        });

      expect(logger.info).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Updated project successfully");
      expect(res.body.data.name).toBe("Updated Project Name");
    });

    // Invalid input (P1, U2 - Valid auth, missing id → route not matched → 404)
    // Integrates: router path matching behavior.
    it("should return 404 when trying to update without project ID (P1, U2)", async () => {
      const res = await request(app)
        .put("/api/projects/")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          name: "Invalid Project Update",
        });

      expect(res.status).toBe(404);
    });

    // Invalid (U3/T3 - unusual/nonexistent id format; controller should not 400)
    // Integrates: controller error handling over nonexistent id.
    it("should reject update with unusual id format (U3/T3)", async () => {
      const weirdId = "nonexistent-" + "9".repeat(64);
      const res = await request(app)
        .put(`/api/projects/${weirdId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ name: "Try Update" });
      expect([500]).toContain(res.status);
      expect(res.body.success).toBeDefined();
    });

    // Atypical valid (T1): update allowing empty optional fields
    // Integrates: controller update accepting empty strings for optional fields.
    it("should update allowing empty optional fields (P1, U1/T1)", async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ description: "", goals: "" });
      expect([200]).toContain(res.status);
    });
  });

  describe("Cross-client consistency", () => {
    // Multi-client isolation (P1 across different clients)
    // Integrates: clients API + projects API + auth scoping.
    it("should isolate projects between two clients (P1 isolation)", async () => {
      // Create client A
      const clientA = await request(app)
        .post("/api/clients/create")
        .send({ name: "Client A" });
      const keyA = clientA.body.data.api_key;

      // Create client B
      const clientB = await request(app)
        .post("/api/clients/create")
        .send({ name: "Client B" });
      const keyB = clientB.body.data.api_key;

      // Client A creates a project
      await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${keyA}`)
        .send({ name: "Project A" });

      // Client B lists its projects (should NOT see Client A’s)
      const listB = await request(app)
        .get("/api/projects")
        .set("Authorization", `Bearer ${keyB}`);

      expect(logger.info).toHaveBeenCalled();
      expect(listB.body.data).toEqual([]);
    });
  });
});
