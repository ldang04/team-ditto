/**
 * RAGService - Unit tests for advanced RAG techniques
 *
 * Tests cover:
 * - Core RAG: performRAG with hybrid search
 * - BM25: Keyword-based retrieval with TF-IDF weighting
 * - RRF: Reciprocal Rank Fusion for combining BM25 + semantic scores
 * - MMR: Maximal Marginal Relevance for diversity in results
 *
 * Equivalence Partitioning Map
 *
 * performRAG(projectId, userPrompt, theme[, config])
 * - PR1 Valid: Content exists with valid embeddings → method "hybrid", metrics present
 * - PR2 Boundary: No project content → method "theme_only", avgSimilarity=1.0
 * - PR3 Boundary: DB error retrieving content → method "theme_only", avgSimilarity=1.0
 * - PR4 Boundary: Content exists but no valid embeddings → method "theme_only", avgSimilarity=0
 * - PR5 Error: EmbeddingService.generateQueryEmbedding throws → empty context (no results)
 * - PR6 Invalid: Undefined projectId/prompt handled gracefully → no throw, valid shape
 * - PR7 Config Boundary: Honors candidatePoolSize/topK → selects exactly topK
 *
 * computeBM25Scores(query, documents[, params])
 * - B1 Valid: Matching terms → positive scores, higher for more matches/rarer terms
 * - B2 Valid: No matching terms → zero scores
 * - B3 Boundary: Empty docs / empty strings → zeros appropriately
 * - B4 Boundary: Length normalization favors concise docs
 * - B5 Config: Custom k1/b parameters accepted
 *
 * tokenize(text)
 * - T1 Valid: Lowercases and removes punctuation
 * - T2 Valid: Removes stop words
 * - T3 Boundary: Filters single-character tokens
 *
 * reciprocalRankFusion(scores1, scores2[, k])
 * - F1 Valid: Different rankings → reasonable fused scores
 * - F2 Valid: Identical rankings → order preserved
 * - F3 Config: Larger k dampens absolute fused scores
 *
 * applyMMR(candidates, queryEmbedding, topK[, lambda])
 * - M1 Valid: Fewer candidates than topK → all selected
 * - M2 Valid: Prefers diversity with moderate lambda
 * - M3 Boundary: lambda=1 → pure relevance (original order by hybridScore)
 * - M4 Boundary: lambda=0 → max diversity
 * - M5 Edge: Empty candidates/topK=0 → empty selection
 */

import logger from "../src/config/logger";
import { RAGService } from "../src/services/RAGService";
import { ContentModel } from "../src/models/ContentModel";
import { EmbeddingsModel } from "../src/models/EmbeddingsModel";
import { EmbeddingService } from "../src/services/EmbeddingService";

jest.mock("../src/models/ContentModel");
jest.mock("../src/models/EmbeddingsModel");
jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

describe("RAGService", () => {
  const originalGenerateQuery = (EmbeddingService as any)
    .generateQueryEmbedding;
  const originalGenerateDocument = (EmbeddingService as any)
    .generateDocumentEmbedding;
  const originalCosine = (EmbeddingService as any).cosineSimilarity;

  afterEach(() => {
    jest.clearAllMocks();
    (EmbeddingService as any).generateQueryEmbedding = originalGenerateQuery;
    (EmbeddingService as any).generateDocumentEmbedding =
      originalGenerateDocument;
    (EmbeddingService as any).cosineSimilarity = originalCosine;
  });

  // PR2 Boundary: No project content → theme_only
  it("returns theme-only context when no project content exists (PR2)", async () => {
    // stub query embedding for prompt
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue(new Array(3).fill(0.1));
    // ContentModel returns empty
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });
    // theme embedding generation uses document embedding; stub that
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue(new Array(3).fill(0.2));

    const theme = {
      id: "t1",
      name: "Theme",
      tags: [],
      inspirations: [],
    } as any;
    const ctx = await RAGService.performRAG("proj1", "prompt", theme);

    expect(ctx.relevantContents).toHaveLength(0);
    expect(ctx.similarDescriptions).toHaveLength(1);
    expect(ctx.avgSimilarity).toBe(1.0);
    expect(EmbeddingService.generateDocumentEmbedding).toHaveBeenCalled();
  });

  // PR1 Valid: Content exists with valid embeddings → hybrid path
  it("returns relevant contents and computes avgSimilarity when embeddings exist (PR1)", async () => {
    const promptEmbedding = [0.1, 0.2, 0.3];
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue(promptEmbedding);

    const contents = [
      { id: "c1", prompt: "p1" },
      { id: "c2", prompt: "p2" },
    ];
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });

    // EmbeddingsModel returns embedding arrays per content
    (EmbeddingsModel.getByContentId as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ embedding: [0.0, 0.0, 1.0] }],
        error: null,
      });

    // Use real cosine similarity implementation for deterministic result
    (EmbeddingService as any).cosineSimilarity = jest.fn(
      (a: number[], b: number[]) => {
        let dot = 0,
          ma = 0,
          mb = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          ma += a[i] * a[i];
          mb += b[i] * b[i];
        }
        ma = Math.sqrt(ma);
        mb = Math.sqrt(mb);
        return ma === 0 || mb === 0 ? 0 : dot / (ma * mb);
      }
    );

    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.5, 0.5, 0.5]);

    const theme = { id: "t2", name: "T2", tags: [], inspirations: [] } as any;
    const ctx = await RAGService.performRAG("proj2", "some prompt", theme);

    expect(ctx.relevantContents.length).toBeGreaterThan(0);
    expect(ctx.similarDescriptions).toContain("p1");
    expect(ctx.similarDescriptions).toContain("p2");
    expect(
      ctx.similarDescriptions.some(
        (s) => typeof s === "string" && s.startsWith("T2:")
      )
    ).toBe(true);
    expect(ctx.avgSimilarity).toBeGreaterThanOrEqual(0);
  });

  // PR1 Valid: Filters out content items without embeddings (still hybrid path)
  it("filters out content items without embeddings (PR1)", async () => {
    const promptEmbedding = [0.1, 0.2, 0.3];
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue(promptEmbedding);

    const contents = [
      { id: "c1", prompt: "p1" },
      { id: "c2", prompt: "p2" },
    ];
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: contents,
      error: null,
    });

    // first has empty embedding, second has a valid one
    (EmbeddingsModel.getByContentId as jest.Mock)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.1, 0.1] }],
        error: null,
      });

    (EmbeddingService as any).cosineSimilarity = jest.fn().mockReturnValue(0.5);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.2, 0.2, 0.2]);

    const ctx = await RAGService.performRAG("proj3", "prompt", {
      id: "t3",
      name: "n",
      tags: [],
      inspirations: [],
    } as any);
    // only one content should be in relevantContents
    expect(ctx.relevantContents).toHaveLength(1);
  });

  // Error: DB returns an error -> theme_only with avgSimilarity=1.0 (R2 via error)
  it("returns theme_only when DB errors (boundary - R2)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([0.3, 0.3, 0.3]);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.4, 0.4, 0.4]);
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error("db failure"),
    });

    const ctx = await RAGService.performRAG("projErr", "prompt", {
      id: "t-err",
      name: "ThemeErr",
      tags: ["x"],
      inspirations: ["y"],
    } as any);

    expect(ctx.method).toBe("theme_only");
    expect(ctx.avgSimilarity).toBe(1.0);
    expect(ctx.similarDescriptions).toHaveLength(1);
  });

  // Boundary: Content exists but all embeddings missing -> theme_only with avgSimilarity=0
  it("falls back to theme_only when no valid embeddings exist (boundary - R3)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([0.1, 0.2, 0.3]);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.2, 0.2, 0.2]);

    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [
        { id: "c1", prompt: "p1", text_content: "alpha" },
        { id: "c2", prompt: "p2", text_content: "beta" },
      ],
      error: null,
    });

    (EmbeddingsModel.getByContentId as jest.Mock)
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const ctx = await RAGService.performRAG("projNoEmb", "query", {
      id: "t-ne",
      name: "ThemeNE",
      tags: ["z"],
      inspirations: ["w"],
    } as any);

    expect(ctx.method).toBe("theme_only");
    expect(ctx.avgSimilarity).toBe(0);
    expect(ctx.similarDescriptions).toHaveLength(1);
  });

  // PR5 Error: Query embedding failure → empty context
  it("returns empty context when query embedding throws (PR5)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockRejectedValue(new Error("bad"));
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    const ctx = await RAGService.performRAG("proj4", "prompt", {
      id: "t4",
      name: "n",
      tags: [],
      inspirations: [],
    } as any);
    expect(ctx.relevantContents).toHaveLength(0);
    expect(ctx.avgSimilarity).toBe(0);
  });

  // PR6 Invalid: Undefined projectId/prompt handled gracefully
  it("handles undefined inputs gracefully (PR6)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([0.1, 0.1, 0.1]);
    // stub document embedding used by theme embedding generation to avoid real API calls
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.2, 0.2, 0.2]);
    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });
    const ctx = await RAGService.performRAG(
      undefined as any,
      undefined as any,
      { id: "t5", name: "n", tags: [], inspirations: [] } as any
    );
    // Should return theme-only or empty context depending on internal behavior; assert it doesn't throw and returns object shaped like RAGContext
    expect(ctx).toHaveProperty("relevantContents");
    expect(ctx).toHaveProperty("themeEmbedding");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BM25 Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RAGService.computeBM25Scores", () => {
  describe("query matching (B1)", () => {
    // B1 Valid: Matching terms → positive scores, ranking aligns with matches
    it("returns positive scores for matching terms", () => {
      const query = "machine learning algorithms";
      const docs = [
        "Introduction to machine learning and deep learning",
        "Advanced algorithms for data processing",
        "Machine learning algorithms explained simply",
      ];

      const scores = RAGService.computeBM25Scores(query, docs);

      // Doc 3 matches all query terms, should score highest
      expect(scores[2]).toBeGreaterThan(scores[0]);
      expect(scores[2]).toBeGreaterThan(scores[1]);
      // All docs have at least one match
      expect(scores.every((s) => s > 0)).toBe(true);
    });

    // B1 Valid: Rarer terms get higher IDF weight
    it("weights rare terms higher (IDF)", () => {
      const query = "unique rare";
      const docs = [
        "common common common unique", // "unique" appears once
        "rare word here", // "rare" is unique to this doc
        "common words only", // no matches
      ];

      const scores = RAGService.computeBM25Scores(query, docs);

      // Doc with "rare" should score well since it's unique
      expect(scores[1]).toBeGreaterThan(scores[2]);
      expect(scores[0]).toBeGreaterThan(scores[2]);
    });
  });

  describe("no matching terms (B2)", () => {
    // B2 Valid: No matching terms → zero scores
    it("returns zero scores when no terms match", () => {
      const query = "quantum physics";
      const docs = [
        "cooking recipes for beginners",
        "gardening tips and tricks",
      ];

      const scores = RAGService.computeBM25Scores(query, docs);

      expect(scores).toEqual([0, 0]);
    });
  });

  describe("empty documents (B3)", () => {
    // B3 Boundary: Empty documents array → empty scores
    it("handles empty documents array", () => {
      const scores = RAGService.computeBM25Scores("query", []);
      expect(scores).toEqual([]);
    });

    // B3 Boundary: Empty strings treated as zero-length docs → zero score
    it("handles documents with empty strings", () => {
      const scores = RAGService.computeBM25Scores("test", ["", "test doc", ""]);
      expect(scores[0]).toBe(0);
      expect(scores[1]).toBeGreaterThan(0);
      expect(scores[2]).toBe(0);
    });
  });

  describe("document length normalization (B4)", () => {
    // B4 Boundary: Shorter doc with same TF should score higher
    it("normalizes for document length", () => {
      const query = "test";
      const docs = [
        "test", // Short doc with term
        "test " + "padding ".repeat(100), // Long doc with same term
      ];

      const scores = RAGService.computeBM25Scores(query, docs);

      // Shorter document should score higher (same TF, less dilution)
      expect(scores[0]).toBeGreaterThan(scores[1]);
    });
  });

  describe("custom parameters", () => {
    // B5 Config: Accepts custom k1/b params
    it("accepts custom k1 and b parameters", () => {
      const query = "test keyword";
      const docs = [
        "test keyword document with more words to see length effect",
      ];

      const defaultScores = RAGService.computeBM25Scores(query, docs);
      const customScores = RAGService.computeBM25Scores(query, docs, {
        k1: 2.0,
        b: 0.9,
      });

      // Both should produce positive scores
      expect(defaultScores[0]).toBeGreaterThan(0);
      expect(customScores[0]).toBeGreaterThan(0);
      // Scores should exist (we don't guarantee they differ due to floating point)
      expect(typeof customScores[0]).toBe("number");
    });
  });
});

describe("RAGService.tokenize", () => {
  // T1 Valid: Lowercases and strips punctuation
  it("lowercases and removes punctuation", () => {
    const tokens = RAGService.tokenize("Hello, World! This is a TEST.");
    expect(tokens).not.toContain("Hello");
    expect(tokens).toContain("hello");
    expect(tokens).toContain("world");
    expect(tokens).toContain("test");
  });

  // T2 Valid: Removes stop words from tokens
  it("removes stop words", () => {
    const tokens = RAGService.tokenize(
      "The quick brown fox is a very fast animal"
    );
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("very");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
  });

  // T3 Boundary: Filters single-character tokens
  it("filters single-character tokens", () => {
    const tokens = RAGService.tokenize("a b c test");
    expect(tokens).not.toContain("b");
    expect(tokens).not.toContain("c");
    expect(tokens).toContain("test");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reciprocal Rank Fusion Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RAGService.reciprocalRankFusion", () => {
  describe("different rankings (F1)", () => {
    // F1 Valid: Fuses differing rankings into balanced fused scores
    it("fuses scores from different ranking systems", () => {
      // BM25 ranking: doc0 > doc1 > doc2
      const bm25Scores = [0.8, 0.5, 0.2];
      // Semantic ranking: doc2 > doc1 > doc0 (reverse)
      const semanticScores = [0.2, 0.5, 0.8];

      const fusedScores = RAGService.reciprocalRankFusion(
        bm25Scores,
        semanticScores
      );

      // All fused scores should be positive
      expect(fusedScores.every((s) => s > 0)).toBe(true);
      // Doc0 has rank 1 + rank 3, Doc2 has rank 3 + rank 1 -> should be equal
      expect(Math.abs(fusedScores[0] - fusedScores[2])).toBeLessThan(0.0001);
    });

    // F1 Valid: Docs ranked highly in both get highest fused score
    it("produces higher scores for docs ranked highly in both", () => {
      // Both agree: doc0 is best
      const scores1 = [0.9, 0.5, 0.1];
      const scores2 = [0.85, 0.4, 0.15];

      const fused = RAGService.reciprocalRankFusion(scores1, scores2);

      expect(fused[0]).toBeGreaterThan(fused[1]);
      expect(fused[0]).toBeGreaterThan(fused[2]);
    });
  });

  describe("identical rankings (F2)", () => {
    // F2 Valid: Identical rankings → order preserved
    it("maintains order for identical rankings", () => {
      const scores = [0.9, 0.7, 0.5, 0.3];
      const fused = RAGService.reciprocalRankFusion(scores, scores);

      // Order should be preserved
      for (let i = 0; i < fused.length - 1; i++) {
        expect(fused[i]).toBeGreaterThan(fused[i + 1]);
      }
    });
  });

  describe("RRF constant k", () => {
    // F3 Config: Larger k dampens magnitude of fused scores
    it("higher k dampens the effect of low ranks", () => {
      // With 3 docs, we can see k's effect more clearly
      const scores1 = [1.0, 0.5, 0.1]; // doc0 > doc1 > doc2
      const scores2 = [1.0, 0.6, 0.2]; // same ranking

      const fusedK10 = RAGService.reciprocalRankFusion(scores1, scores2, 10);
      const fusedK100 = RAGService.reciprocalRankFusion(scores1, scores2, 100);

      // Both should produce valid fused scores with same ranking order
      expect(fusedK10[0]).toBeGreaterThan(fusedK10[1]);
      expect(fusedK100[0]).toBeGreaterThan(fusedK100[1]);
      // Higher k should produce smaller absolute scores (1/(k+r) gets smaller)
      expect(fusedK100[0]).toBeLessThan(fusedK10[0]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MMR Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RAGService.applyMMR", () => {
  // Helper to create candidates with orthogonal embeddings
  const makeCandidate = (hybridScore: number, embedding: number[]) => ({
    hybridScore,
    embedding,
    id: `doc-${hybridScore}`,
  });

  describe("diverse candidates (M1)", () => {
    // M1 Valid: Fewer candidates than topK → all returned
    it("selects all when candidates are fewer than topK", () => {
      const candidates = [
        makeCandidate(0.8, [1, 0, 0]),
        makeCandidate(0.6, [0, 1, 0]),
      ];

      const selected = RAGService.applyMMR(candidates, [1, 0, 0], 5, 0.7);

      expect(selected).toHaveLength(2);
    });
  });

  describe("similar candidates (M2)", () => {
    // M2 Valid: With moderate lambda, prefers diversity among similar candidates
    it("prefers diverse candidates over similar ones", () => {
      // Three candidates: two are similar (close embeddings), one is different
      const candidates = [
        makeCandidate(0.9, [1, 0, 0]), // High score, similar to query
        makeCandidate(0.85, [0.99, 0.1, 0]), // High score, very similar to first
        makeCandidate(0.7, [0, 1, 0]), // Lower score, but different
      ];

      const selected = RAGService.applyMMR(candidates, [1, 0, 0], 2, 0.5);

      // Should select the diverse candidate (index 2) over the similar one (index 1)
      const ids = selected.map((s) => s.id);
      expect(ids).toContain("doc-0.9"); // Best score always selected first
      // With lambda=0.5, diversity matters, so doc-0.7 should be preferred over doc-0.85
      expect(ids).toContain("doc-0.7");
    });
  });

  describe("lambda = 1 (M3)", () => {
    // M3 Boundary: lambda=1 → pure relevance selection
    it("selects purely by relevance when lambda is 1", () => {
      const candidates = [
        makeCandidate(0.9, [1, 0, 0]),
        makeCandidate(0.8, [0.99, 0.01, 0]), // Very similar but lower score
        makeCandidate(0.5, [0, 1, 0]), // Different but lowest score
      ];

      const selected = RAGService.applyMMR(candidates, [1, 0, 0], 2, 1.0);

      // With lambda=1, should just take top 2 by hybrid score
      expect(selected[0].hybridScore).toBe(0.9);
      expect(selected[1].hybridScore).toBe(0.8);
    });
  });

  describe("lambda = 0 (M4)", () => {
    // M4 Boundary: lambda=0 → maximizes diversity regardless of score
    it("maximizes diversity when lambda is 0", () => {
      const candidates = [
        makeCandidate(0.9, [1, 0, 0]),
        makeCandidate(0.85, [0.9, 0.1, 0]), // Similar to first
        makeCandidate(0.3, [0, 0, 1]), // Very different (orthogonal)
      ];

      const selected = RAGService.applyMMR(candidates, [1, 0, 0], 2, 0.0);

      // First selected by score, then maximally diverse one selected
      expect(selected[0].hybridScore).toBe(0.9);
      // The orthogonal one should be selected despite low score
      expect(selected[1].hybridScore).toBe(0.3);
    });
  });

  describe("edge cases", () => {
    // M5 Edge: Empty candidates array → empty selection
    it("handles empty candidates array", () => {
      const selected = RAGService.applyMMR([], [1, 0, 0], 5, 0.7);
      expect(selected).toEqual([]);
    });

    // M5 Edge: topK=0 → empty selection
    it("handles topK of 0", () => {
      const candidates = [makeCandidate(0.9, [1, 0, 0])];
      const selected = RAGService.applyMMR(candidates, [1, 0, 0], 0, 0.7);
      expect(selected).toEqual([]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Hybrid RAG with all techniques
// ─────────────────────────────────────────────────────────────────────────────

describe("RAGService - Hybrid RAG integration", () => {
  const originalGenerateQuery = (EmbeddingService as any)
    .generateQueryEmbedding;
  const originalGenerateDocument = (EmbeddingService as any)
    .generateDocumentEmbedding;
  const originalCosine = (EmbeddingService as any).cosineSimilarity;

  afterEach(() => {
    jest.clearAllMocks();
    (EmbeddingService as any).generateQueryEmbedding = originalGenerateQuery;
    (EmbeddingService as any).generateDocumentEmbedding =
      originalGenerateDocument;
    (EmbeddingService as any).cosineSimilarity = originalCosine;
  });

  // PR1 Valid: Hybrid path when content exists
  it("returns method: hybrid when content exists (PR1)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([0.1, 0.2, 0.3]);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.2, 0.2, 0.2]);
    (EmbeddingService as any).cosineSimilarity = jest.fn().mockReturnValue(0.5);

    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [{ id: "c1", prompt: "p1", text_content: "test content" }],
      error: null,
    });
    (EmbeddingsModel.getByContentId as jest.Mock).mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
      error: null,
    });

    const ctx = await RAGService.performRAG("proj", "query", {
      id: "t1",
      name: "Theme",
      tags: [],
      inspirations: [],
    } as any);

    expect(ctx.method).toBe("hybrid");
  });

  // PR2 Boundary: theme_only when no content
  it("returns method: theme_only when no content exists (PR2)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([0.1, 0.2, 0.3]);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.2, 0.2, 0.2]);

    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    });

    const ctx = await RAGService.performRAG("proj", "query", {
      id: "t1",
      name: "Theme",
      tags: [],
      inspirations: [],
    } as any);

    expect(ctx.method).toBe("theme_only");
  });

  // PR1 Valid: Includes retrieval metrics on hybrid path
  it("includes retrieval metrics when content exists (PR1)", async () => {
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([0.1, 0.2, 0.3]);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.2, 0.2, 0.2]);
    (EmbeddingService as any).cosineSimilarity = jest.fn().mockReturnValue(0.6);

    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [
        {
          id: "c1",
          prompt: "marketing content",
          text_content: "marketing strategies",
        },
        { id: "c2", prompt: "ad copy", text_content: "advertising campaigns" },
      ],
      error: null,
    });
    (EmbeddingsModel.getByContentId as jest.Mock)
      .mockResolvedValueOnce({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ embedding: [0.4, 0.5, 0.6] }],
        error: null,
      });

    const ctx = await RAGService.performRAG("proj", "marketing query", {
      id: "t1",
      name: "Theme",
      tags: [],
      inspirations: [],
    } as any);

    expect(ctx.metrics).toBeDefined();
    expect(ctx.metrics?.bm25TopScore).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics?.semanticTopScore).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics?.hybridTopScore).toBeGreaterThan(0);
    expect(ctx.metrics?.diversityScore).toBeGreaterThanOrEqual(0);
  });

  // PR7 Config: Honors candidatePoolSize/topK
  it("respects topK and candidatePoolSize config (selects exactly topK) (PR7)", async () => {
    // Query embedding aligned with first doc embedding to make it the top pick
    (EmbeddingService as any).generateQueryEmbedding = jest
      .fn()
      .mockResolvedValue([1, 0, 0]);
    (EmbeddingService as any).generateDocumentEmbedding = jest
      .fn()
      .mockResolvedValue([0.3, 0.3, 0.3]);
    // Realistic cosine similarity
    (EmbeddingService as any).cosineSimilarity = jest.fn(
      (a: number[], b: number[]) => {
        let dot = 0,
          ma = 0,
          mb = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          ma += a[i] * a[i];
          mb += b[i] * b[i];
        }
        ma = Math.sqrt(ma);
        mb = Math.sqrt(mb);
        return ma === 0 || mb === 0 ? 0 : dot / (ma * mb);
      }
    );

    (ContentModel.listByProject as jest.Mock).mockResolvedValue({
      data: [
        { id: "c1", prompt: "p1", text_content: "alpha" },
        { id: "c2", prompt: "p2", text_content: "beta" },
        { id: "c3", prompt: "p3", text_content: "gamma" },
      ],
      error: null,
    });
    (EmbeddingsModel.getByContentId as jest.Mock)
      .mockResolvedValueOnce({ data: [{ embedding: [1, 0, 0] }], error: null })
      .mockResolvedValueOnce({ data: [{ embedding: [0, 1, 0] }], error: null })
      .mockResolvedValueOnce({ data: [{ embedding: [0, 0, 1] }], error: null });

    const ctx = await RAGService.performRAG(
      "proj",
      "alpha",
      {
        id: "t1",
        name: "Theme",
        tags: [],
        inspirations: [],
      } as any,
      {
        candidatePoolSize: 2,
        topK: 1,
        mmrLambda: 0.7,
        rrfK: 60,
        bm25: { k1: 1.5, b: 0.75 },
      }
    );

    expect(ctx.relevantContents).toHaveLength(1);
    // Best match should be the one aligned with the query embedding
    expect(ctx.similarDescriptions).toContain("p1");
  });
});
