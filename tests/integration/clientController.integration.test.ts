/**
 * Client Controller — Integration Tests (internal + external, no external mocks)
 *
 * What this integrates:
 * - Express app wiring (`src/app.ts`): real middleware, routing, and controller attachment.
 * - Routes (`/api/clients/create`): real route handlers invoking the controller.
 * - Controller (`ClientController.createClient`): input validation, API key generation, orchestration.
 * - Persistence (`src/config/supabaseClient` + models/services): real Supabase client inserts and queries (no Jest moduleNameMapper in integration project).
 * - Common middleware: parsing/logging/auth as configured in the app are active in the request lifecycle.
 * - Provider initialization: services like Embeddings/Text/Image initialize (Vertex AI/Gemini) on app import, verifying environment readiness.
 *
 * Class interaction flow (create client):
 * 1) Request enters Express → routed to client controller.
 * 2) Controller validates `name` and prepares data (e.g., `api_key`).
 * 3) Controller calls persistence layer using the real Supabase client.
 * 4) DB returns inserted record; controller formats success response.
 * 5) If schema mismatches (e.g., absent `email`/`organization` columns) or validation fails → controller returns 400/500.
 *
 * Partitions (Create Client):
 * - C1 Valid: name provided → 201/200
 * - C2 Invalid: name missing/empty/whitespace → 400
 * - C3 Atypical: missing optional fields accepted; unsupported fields (like `email` without column) error
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
jest.setTimeout(15000);

import request from "supertest";
import app from "../../src/app";

describe("Client Controller Integration", () => {
  beforeAll(async () => {});

  describe("POST /api/clients/create", () => {
    /**
     * Integrates: Express routing → ClientController.createClient → real Supabase insert.
     * Validates: required `name`, API key generation, success response.
     * External: Uses real DB client (no Jest mapper) to persist the client.
     */
    it("creates client with valid payload (C1)", async () => {
      const res = await request(app)
        .post("/api/clients/create")
        .send({ name: "Acme" });
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("api_key");
    });

    /**
     * Integrates: Express routing → ClientController.createClient input validation.
     * Validates: missing/empty/whitespace `name` yields HTTP 400 and `{ success: false }`.
     * External: DB not invoked due to controller-side validation failure.
     */
    it("rejects when name is missing or empty (C2)", async () => {
      const cases = [{}, { name: "" }, { name: "   " }];
      for (const body of cases) {
        const res = await request(app).post("/api/clients/create").send(body);
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });

    /**
     * Integrates: Full stack with real persistence while omitting optional fields.
     * Validates: controller accepts minimal payload `{ name }` and persists successfully.
     * External: Real Supabase insert executes; success confirms schema supports minimal fields.
     */
    it("accepts atypical email cases (missing) (C3a)", async () => {
      const res1 = await request(app)
        .post("/api/clients/create")
        .send({ name: "NoEmailCo" });
      expect([200, 201]).toContain(res1.status);
      expect(res1.body.success).toBe(true);
    });

    /**
     * Integrates: Controller + real DB call with unsupported field.
     * Validates: sending `email` when the column is absent triggers error handling (400/500).
     * External: Real Supabase insert fails; ensures controller surfaces DB/schema errors.
     */
    it("rejects atypical email cases (column absent / bad format) (C3b)", async () => {
      const res2 = await request(app)
        .post("/api/clients/create")
        .send({ name: "BadEmailCo", email: "not-an-email" });
      expect([400, 500]).toContain(res2.status);
      expect(res2.body.success).toBe(false);
    });
  });
});
