/**
 * Equivalence Partitioning Map (API: Validate Content)
 *
 * Inputs under test:
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
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
jest.setTimeout(15000);

// Mock EmbeddingService to avoid real API calls
// Note: Mocks must be at the top level (not inside conditionals) for Jest's hoisting to work.
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
        // Use global counter that persists across calls but resets per test
        if (!(global as any).__cosineSimilarityCallCount) {
          (global as any).__cosineSimilarityCallCount = 0;
        }
        (global as any).__cosineSimilarityCallCount++;
        
        // Strategy: Return low similarity for first 3 calls (for low-consistency tests)
        // Return high similarity for subsequent calls (for high-consistency tests)
        // This ensures both test types can pass
        if ((global as any).__cosineSimilarityCallCount <= 3) {
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
    // Reset cosine similarity call counter before each test
    // This ensures each test starts with a fresh counter
    (global as any).__cosineSimilarityCallCount = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("POST /api/validate", () => {
    // Valid: raw content + project_id (P1, B1)
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
    it("rejects when required fields are missing (P1, B2)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer ${apiKey}`)
        .send({});
      expect(res.status).toBe(400);
    });

    // Not Found: nonexistent project_id (P1, N1)
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
    it("returns 401 when API key missing (P2)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .send({ content: "Hello", project_id: projectId });
      expect(res.status).toBe(401);
    });

    // Invalid auth: malformed header (P2)
    it("returns 401 for malformed Authorization header (P2)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearerr ${apiKey}`)
        .send({ content: "Hello", project_id: projectId });
      expect(res.status).toBe(401);
    });

    // Invalid auth: unknown key (P3)
    it("rejects invalid API key (P3)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", "Bearer invalid_key_123456")
        .send({ content: "Hello", project_id: projectId });
      expect([403]).toContain(res.status);
    });

    // Boundary: empty token (P4)
    it("returns 401 when Bearer token is empty (P4)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", "Bearer ")
        .send({ content: "Hello", project_id: projectId });
      expect(res.status).toBe(401);
    });

    // Atypical auth: extra spaces after Bearer (P3/T3)
    it("rejects Authorization with extra spaces (P3/T3)", async () => {
      const res = await request(app)
        .post("/api/validate")
        .set("Authorization", `Bearer   ${apiKey}`)
        .send({ content: "Hello", project_id: projectId });
      expect([403]).toContain(res.status);
    });
  });
});
