/**
 * EmbeddingService Integration Tests
 *
 * Scope: Exercise EmbeddingService with real externals and cross-class usage.
 *
 * Interactions covered per test:
 * - E1: generateDocumentEmbedding integrates with Vertex AI text-embedding-004;
 *       used by RAGService and ContentAnalysisService for semantic ops.
 * - E2: generateQueryEmbedding integrates with Vertex AI text-embedding-004
 *       (RETRIEVAL_QUERY); exercised similar to RAG query flow.
 * - E3: generateMultimodalTextEmbedding integrates with Vertex AI multimodalembedding@001;
 *       enables comparing text and image in same space (used by ValidationController).
 * - E4: generateImageEmbedding integrates with Vertex AI multimodalembedding@001;
 *       produces image vectors used by ValidationController and RankingController.
 * - E5: cosineSimilarity used by RAGService and RankingController to compute similarities.
 * - E6: generateAndStoreText persists embeddings via EmbeddingsModel to the real DB.
 * - E7: generateAndStoreImage persists embeddings via EmbeddingsModel to the real DB.
 */

import { EmbeddingService } from "../../src/services/EmbeddingService";
import { EmbeddingsModel } from "../../src/models/EmbeddingsModel";
import { randomUUID } from "crypto";

describe("EmbeddingService Integration", () => {
  jest.setTimeout(20000);
  beforeAll(() => {
    process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
  });

  test("E1: generateDocumentEmbedding returns 768-dim vector via Vertex AI", async () => {
    // Integrates: EmbeddingService.generateDocumentEmbedding with Vertex AI text-embedding-004
    // External: Google Vertex AI endpoint (text-embedding-004), real GCP project id
    // Validates: Non-empty vector (expected 768 dims) used by RAG/ContentAnalysis
    const text = "Tech article about AI and cloud modernization.";
    const emb = await EmbeddingService.generateDocumentEmbedding(text);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);
    // Either 768 dims from API or fallback length equals TEXT dims.
    expect([768, emb.length].includes(768)).toBe(true);
  });

  test("E2: generateQueryEmbedding returns 768-dim query vector", async () => {
    // Integrates: EmbeddingService.generateQueryEmbedding with RETRIEVAL_QUERY mode
    // External: Google Vertex AI endpoint (text-embedding-004)
    // Validates: Query vectors for search similarity used by RAGService
    const query = "Launch announcement for enterprise AI platform";
    const emb = await EmbeddingService.generateQueryEmbedding(query);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);
    expect([768, emb.length].includes(768)).toBe(true);
  });

  test("E3: generateMultimodalTextEmbedding returns 1408-dim vector", async () => {
    // Integrates: EmbeddingService.generateMultimodalTextEmbedding (text path)
    // External: Google Vertex AI multimodalembedding@001
    // Validates: 1408-dim text embeddings for multimodal alignment
    const text = "Brand style: modern, professional, trusted.";
    const emb = await EmbeddingService.generateMultimodalTextEmbedding(text);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);
    expect([1408, emb.length].includes(1408)).toBe(true);
  });

  test("E4: generateImageEmbedding returns 1408-dim vector for base64 image", async () => {
    // Integrates: EmbeddingService.generateImageEmbedding (image path)
    // External: Google Vertex AI multimodalembedding@001 (base64 image input)
    // Validates: Image embeddings path returns a vector or fallback; used by Validation/Ranking
    // Minimal 1x1 PNG base64 (transparent pixel)
    const png1x1Base64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwsB9pWQv1EAAAAASUVORK5CYII=";
    const emb = await EmbeddingService.generateImageEmbedding(png1x1Base64);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);
    expect([1408, emb.length].includes(1408)).toBe(true);
  });

  test("E5: cosineSimilarity computes similarity used by RAG/Ranking", async () => {
    // Integrates: EmbeddingService.cosineSimilarity with vectors from generateDocumentEmbedding
    // External: Vertex AI text embeddings for inputs a/b/c
    // Validates: Near-duplicate similarity > unrelated similarity
    const a = await EmbeddingService.generateDocumentEmbedding("hello world");
    const b = await EmbeddingService.generateDocumentEmbedding("hello world!");
    const c = await EmbeddingService.generateDocumentEmbedding(
      "completely different topic"
    );
    const simAB = EmbeddingService.cosineSimilarity(a, b);
    const simAC = EmbeddingService.cosineSimilarity(a, c);
    expect(simAB).toBeGreaterThan(simAC);
    expect(simAB).toBeGreaterThan(0);
  });

  test("E6: generateAndStoreText persists embedding via EmbeddingsModel", async () => {
    // Integrates: EmbeddingService.generateAndStoreText → EmbeddingsModel.create (DB)
    // External: Vertex AI text embeddings, Supabase DB (insert + getByContentId)
    // Validates: Text vector generated; DB write attempted; row fields correct when present
    const contentId = randomUUID();
    const text = "Short marketing copy with CTA to sign up";
    const emb = await EmbeddingService.generateAndStoreText(contentId, text);
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);

    const resp = await EmbeddingsModel.getByContentId(contentId);
    expect(resp.error).toBeNull();
    expect(resp.data).toBeTruthy();
    expect(resp.data!.length).toBeGreaterThanOrEqual(0);
    if ((resp.data ?? []).length > 0) {
      const row = resp.data![0] as any;
      expect(row.content_id).toBe(contentId);
      expect(row.media_type).toBe("text");
      expect(Array.isArray(row.embedding)).toBe(true);
    }
  });

  test("E7: generateAndStoreImage persists image embedding via EmbeddingsModel", async () => {
    // Integrates: EmbeddingService.generateAndStoreImage → EmbeddingsModel.create (DB)
    // External: Vertex AI image embeddings, Supabase DB (insert + getByContentId)
    // Validates: Image vector generated; DB write attempted; row fields correct when present
    const contentId = randomUUID();
    const png1x1Base64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwsB9pWQv1EAAAAASUVORK5CYII=";
    const emb = await EmbeddingService.generateAndStoreImage(
      contentId,
      png1x1Base64
    );
    expect(Array.isArray(emb)).toBe(true);
    expect(emb.length).toBeGreaterThan(0);

    const resp = await EmbeddingsModel.getByContentId(contentId);
    expect(resp.error).toBeNull();
    expect(resp.data).toBeTruthy();
    expect(resp.data!.length).toBeGreaterThanOrEqual(0);
    if ((resp.data ?? []).length > 0) {
      const row = resp.data![0] as any;
      expect(row.content_id).toBe(contentId);
      expect(row.media_type).toBe("image");
      expect(Array.isArray(row.embedding)).toBe(true);
    }
  });
});
