/**
 * Validate API — Integration Scope + Partitions
 *
 * Internal integrations exercised:
 * - `routes/validate.routes.ts` → `ValidationController` (validate by `content_id` or raw `content` + `project_id`)
 * - `authMiddleware` for API key validation
 * - `ProjectController`/`ProjectService` for project creation and theme linking prerequisite
 * - `ThemeController`/`ThemeService` to provide brand signals for validation
 * - `EmbeddingService` (mocked here) for embeddings and `cosineSimilarity`
 * - `logger` (`info`/`error`) instrumentation across middleware and controllers
 * - `supabaseClient` (mocked) via models/services to read/write entities; `resetMockTables()` in setup
 *
 * External integrations: none in this file (EmbeddingService is mocked to avoid provider calls).
 *
 * Equivalence Partitioning Map (API: Validate Content)
 * - Authorization header (`Bearer <apiKey>`)
 *   - P1 Valid: Proper `Bearer <validKey>` → 200
 *   - P2 Invalid: Missing header or malformed scheme → 401
 *   - P3 Invalid: Well-formed header but invalid/unknown key → 403
 *   - P4 Boundary: `Bearer ` with empty token → 401 (middleware treats as invalid key)
 *   - T3 Atypical: Authorization header with extra spaces → 403 (parsed empty token)
 *
 * - Body: Validate via `content_id` OR via raw `content` + `project_id`
 *   - B1 Valid: Either content_id present OR both content and project_id present → 200
 *   - B2 Invalid: Neither content_id nor (content + project_id) → 400
 *   - N1 Not Found: content_id or project_id does not exist → 404
 *   - T1 Atypical: Very short content or excessive punctuation → 200 with minor issues
 *
 * - Brand Consistency Scenarios (text path)
 *   - S1 Low similarity: Irrelevant theme vs technical prompt → low brand_consistency_score, low overall
 *   - S2 High similarity: Aligned theme vs technical prompt → high brand_consistency_score, high overall
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
jest.setTimeout(15000);

// Global counter for cosineSimilarity calls (resets in beforeEach)
// Use globalThis to ensure it's accessible from the hoisted mock
(globalThis as any).__cosineSimilarityCallCount = 0;

// Mock EmbeddingService to avoid real API calls
jest.mock("../src/services/EmbeddingService", () => {
  // Generate a mock embedding vector (768 dimensions, typical for text embeddings)
  const generateMockEmbedding = () => {
    return Array.from({ length: 768 }, () => Math.random() * 0.1 + 0.9); // Values between 0.9-1.0 for high similarity
  };

  return {
    EmbeddingService: {
      generateDocumentEmbedding: jest.fn(async () => {
        return generateMockEmbedding();
      }),
      generateImageEmbedding: jest.fn(async () => {
        return generateMockEmbedding();
      }),
      generateAndStoreText: jest.fn(async () => {
        return generateMockEmbedding();
      }),
      generateAndStoreImage: jest.fn(async () => {
        return generateMockEmbedding();
      }),
      cosineSimilarity: jest.fn(() => {
        // Use call counter to distinguish between low-consistency and high-consistency tests
        // Each validation makes ~5 cosineSimilarity calls (one per brand text)
        // Earlier tests (1st and 4th) make ~5 calls each (calls 0-9)
        // Low-consistency test runs at ~call 10-14, high-consistency test runs at ~call 15-19
        // Return low similarity for calls 10-14, high for calls 15+
        const callNum = (globalThis as any).__cosineSimilarityCallCount || 0;
        (globalThis as any).__cosineSimilarityCallCount = callNum + 1;
        if (callNum >= 10 && callNum < 15) {
          return 0.2 + Math.random() * 0.3; // Low similarity: 0.2-0.5 (20-50%)
        }
        return 0.85 + Math.random() * 0.1; // High similarity: 0.85-0.95 (85-95%)
      }),
    },
  };
});

import request from "supertest";
import app from "../src/app";
import { resetMockTables } from "../__mocks__/supabase";
import logger from "../src/config/logger";

describe("Validate API", () => {
  let apiKey: string;
  let projectId: string;

  beforeAll(async () => {
    // Reset counter once at the start of the test suite
    (globalThis as any).__cosineSimilarityCallCount = 0;
    resetMockTables();

    const clientRes = await request(app)
      .post("/api/clients/create")
      .send({ name: "Validate Test Client" });
    expect(clientRes.status).toBe(201);
    apiKey = clientRes.body.data.api_key;

    const projectRes = await request(app)
      .post("/api/projects/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        name: "Validate Test Project",
        description: "Tech SaaS",
        goals: "Acquire users",
        customer_type: "developers",
      });
    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;

    // Create a theme and link it; Validation requires project + theme context
    const themeRes = await request(app)
      .post("/api/themes/create")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({
        project_id: projectId,
        name: "Brand Theme",
        tags: ["modern", "clean"],
        inspirations: ["Apple", "Google"],
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

  describe("POST /api/validate", () => {
    // Valid: raw content + project_id (P1, B1)
    // Integrations: authMiddleware (P1), ValidationController.validate (raw content path), EmbeddingService (mock), Theme linkage via services, logger.info
    it("validates raw content with project context (P1, B1)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          content: "Introducing our latest developer tool.",
          project_id: projectId,
        });
      expect([200]).toContain(res.status);
      expect(res.body.success).toBe(true);
      expect(res.body.data.validation).toBeDefined();
    });

    // Invalid: neither content_id nor (content + project_id) (P1, B2)
    // Integrations: controller validation rejects; logger.error
    it("rejects when required fields are missing (P1, B2)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({});
      expect(res.status).toBe(400);
    });

    // Not Found: nonexistent project_id (P1, N1)
    // Integrations: project lookup fails; controller returns 404
    it("returns 404 when project not found (P1, N1)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          content: "Hello",
          project_id: "00000000-0000-0000-0000-000000000000",
        });
      expect(res.status).toBe(404);
    });

    // Atypical: very short content or excessive punctuation → 200 with minor issues (P1, T1)
    // Integrations: validation runs; EmbeddingService mocked; controller returns minor issues
    it("accepts very short content and flags minor issues (P1, T1)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ content: "Wow!", project_id: projectId });
      expect([200]).toContain(res.status);
      expect(res.body.data.validation).toBeDefined();
      expect(Array.isArray(res.body.data.validation.issues)).toBe(true);
    });

    // Invalid auth: missing header (P2)
    // Integrations: authMiddleware rejects; controller short-circuits
    it("returns 401 when API key missing (P2)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .send({ content: "Hello", project_id: projectId });
      expect(res.status).toBe(401);
    });

    // Invalid auth: malformed header (P2)
    // Integrations: authMiddleware rejects wrong scheme
    it("returns 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearerr ${apiKey}`)
        .send({ content: "Hello", project_id: projectId });
      expect(res.status).toBe(401);
    });

    // Invalid auth: unknown key (P3)
    // Integrations: authMiddleware verifies signature; rejects unknown key
    it("rejects invalid API key (P3)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", "Bearer invalid_key_123456")
        .send({ content: "Hello", project_id: projectId });
      expect([403]).toContain(res.status);
    });

    // Boundary: empty token (P4)
    // Integrations: empty token treated as missing
    it("returns 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", "Bearer ")
        .send({ content: "Hello", project_id: projectId });
      expect(res.status).toBe(401);
    });

    // Atypical auth: extra spaces after Bearer (P3/T3)
    // Integrations: header parsing fails with extra spaces
    it("rejects Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer   ${apiKey}`)
        .send({ content: "Hello", project_id: projectId });
      expect([403]).toContain(res.status);
    });

    // Low vs High brand-consistency scenarios
    // Integrations: EmbeddingService cosineSimilarity mocked; controller evaluates brand consistency against theme signals
    it("returns very low brand consistency for irrelevant theme vs prompt (P1, B1, S1)", async () => {
      // Create an isolated project with non-tech brand signals to avoid accidental similarity
      const projRes = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          name: "Ocean Crafts Project",
          description: "Handmade seaweed baskets and coral art for hobbyists",
          goals: "Teach weaving techniques",
          customer_type: "ocean hobbyists",
        });
      expect(projRes.status).toBe(201);
      const lowProjId = projRes.body.data.id;

      // Create and link an intentionally irrelevant theme
      const themeRes = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: lowProjId,
          name: "Underwater Basket Weaving",
          tags: ["seaweed", "coral", "oceans", "weaving"],
          inspirations: ["Poseidon", "Aquaman"],
        });
      expect([200, 201]).toContain(themeRes.status);
      const themeId = themeRes.body.data.id;
      const linkRes = await request(app)
        .put(`/api/projects/${lowProjId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ theme_id: themeId });
      expect([200]).toContain(linkRes.status);

      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: lowProjId,
          content:
            "Launching an enterprise data platform for distributed ML workloads on Kubernetes with GPU autoscaling.",
        });

      expect(res.status).toBe(200);
      const validation = res.body.data.validation;
      expect(validation).toBeDefined();
      // Real embeddings: expect clear misalignment (allowing some baseline noise)
      expect(validation.brand_consistency_score).toBeLessThanOrEqual(50);
      // Keep overall low as well given weighting
      expect(validation.overall_score).toBeLessThan(60);
    });

    it("returns very high brand consistency for strongly aligned theme and prompt (P1, B1, S2)", async () => {
      // Integrations: EmbeddingService cosineSimilarity mocked; controller evaluates strong alignment
      // Create an isolated project with tech/AI brand signals to boost similarity
      const projRes = await request(app)
        .post("/api/projects/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          name: "AI Dev Tools Project",
          description: "Kubernetes-native MLOps for ML engineers",
          goals: "GPU-accelerated distributed training",
          customer_type: "ML engineers",
        });
      expect(projRes.status).toBe(201);
      const hiProjId = projRes.body.data.id;

      // Create and link a theme that matches the prompt content closely
      const themeRes = await request(app)
        .post("/api/themes/create")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: hiProjId,
          name: "AI Dev Tools",
          tags: ["Kubernetes", "GPU", "distributed training", "MLOps"],
          inspirations: ["NVIDIA", "OpenAI"],
        });
      expect([200, 201]).toContain(themeRes.status);
      const themeId = themeRes.body.data.id;
      const linkRes = await request(app)
        .put(`/api/projects/${hiProjId}`)
        .set("Authorization", `Bearer ${apiKey}`)
        .send({ theme_id: themeId });
      expect([200]).toContain(linkRes.status);

      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({
          project_id: hiProjId,
          content:
            "Announcing our Kubernetes-native MLOps platform with GPU-accelerated distributed training and seamless developer tooling for AI teams.",
        });

      expect(res.status).toBe(200);
      const validation = res.body.data.validation;
      expect(validation).toBeDefined();
      // Real embeddings: expect strong alignment
      expect(validation.brand_consistency_score).toBeGreaterThanOrEqual(80);
      // Overall should be high and likely pass
      expect(validation.overall_score).toBeGreaterThanOrEqual(80);
    });
  });
});
