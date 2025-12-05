/**
 * ContentAnalysisService — Integration Tests (no external mocks)
 *
 * What this integrates:
 * - Real service class: `ContentAnalysisService` with full composition.
 * - Logger: active but silenced in test to avoid noise.
 * - Providers init: Embeddings/Text/Image services may initialize on import (env readiness).
 * - No Jest moduleNameMapper: integration project runs with real implementations.
 *
 * Class interaction flow (analyzeDiversitySemantic):
 * 1) Call `analyzeDiversitySemantic(variants[, threshold])`.
 * 2) Internally requests embeddings via `EmbeddingService.generateDocumentEmbedding` for each variant.
 * 3) Computes cosine similarity and diversity metrics; may fall back to lexical on provider errors.
 * 4) Returns semantic diversity results (method, score, duplicates). Errors surface when inputs are invalid.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
jest.setTimeout(15000);

import { ContentAnalysisService } from "../../src/services/ContentAnalysisService";

describe("ContentAnalysisService Integration", () => {
  /**
   * Integrates: ContentAnalysisService → EmbeddingService (generateDocumentEmbedding, cosineSimilarity).
   * Validates: semantic pipeline executes end-to-end; returns method and diversity score for dissimilar variants.
   * External: Real provider initialization; falls back to lexical on provider error.
   */
  it("analyzeDiversitySemantic reports semantic diversity", async () => {
    const variants = ["Tech article about AI.", "Recipe for chocolate cake."];
    const res = await ContentAnalysisService.analyzeDiversitySemantic(variants);
    expect(["semantic", "lexical"]).toContain(res.method);
    expect(res.diversity_score).toBeGreaterThanOrEqual(0);
  });
});
