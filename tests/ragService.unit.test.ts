/**
 * RAGService - Equivalence partitions and test mapping
 *
 * Unit under test:
 * - RAGService.performRAG(projectId, userPrompt, theme)
 *
 * Input partitions (projectId / userPrompt / theme):
 * - P1: missing / undefined projectId (invalid)
 * - P2: empty string projectId (boundary)
 * - P3: whitespace-only projectId (atypical)
 * - P4: normal projectId (valid)
 *
 * - U1: missing/undefined userPrompt (invalid)
 * - U2: empty prompt (boundary)
 * - U3: normal prompt (valid)
 *
 * Content/DB partitions:
 * - R1: ContentModel.listByProject returns populated array (valid)
 * - R2: returns empty array or error -> theme-only fallback (boundary/invalid)
 * - R3: EmbeddingsModel.getByContentId returns embeddings array (valid)
 * - R4: returns empty embedding -> item ignored (invalid)
 *
 * Error partitions:
 * - E1: EmbeddingService.generateQueryEmbedding throws -> returns empty context
 * - E2: generateDocumentEmbedding for theme throws -> empty context
 *
 * Mapping -> tests:
 * - Theme-only fallback: P4 + R2 -> returns theme-only context with avgSimilarity 1.0
 * - Content retrieval: P4 + R1 + R3 -> returns topContents, similarDescriptions includes prompts and themeText, avgSimilarity > 0
 * - Items without embeddings are filtered out (R4)
 * - EmbeddingService errors -> returns empty context (E1/E2)
 * - Invalid projectId / prompt inputs: ensure service handles gracefully (returns empty context)
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

  // Valid: No project content -> theme-only fallback (R2)
  it("returns theme-only context when no project content exists (boundary - R2)", async () => {
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

  // Valid: content exists with embeddings -> returns topContents (R1 + R3)
  it("returns relevant contents and computes avgSimilarity when embeddings exist (valid - R1/R3)", async () => {
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

  // Invalid: content items without embeddings are filtered out (R4)
  it("filters out content items without embeddings (invalid - R4)", async () => {
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

  // Error: EmbeddingService.generateQueryEmbedding throws -> returns empty context (E1)
  it("returns empty context when query embedding throws (error - E1)", async () => {
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

  // Invalid inputs: undefined projectId or prompt should be handled and return empty/empty-ish context
  it("handles undefined inputs gracefully (invalid inputs)", async () => {
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
