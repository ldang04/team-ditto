import { EmbeddingService } from "../src/services/EmbeddingService";
import { EmbeddingsModel } from "../src/models/EmbeddingsModel";

// Mock dependencies
jest.mock("google-auth-library", () => {
  return {
    GoogleAuth: jest.fn().mockImplementation(() => ({
      getClient: jest.fn().mockResolvedValue({
        request: jest.fn().mockResolvedValue({
          data: { predictions: [{ embeddings: { values: [0.1, 0.2, 0.3] } }] },
        }),
      }),
    })),
  };
});

jest.mock("../src/models/EmbeddingsModel", () => ({
  EmbeddingsModel: {
    create: jest.fn(),
  },
}));

describe("EmbeddingService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GCP_PROJECT_ID = "mock-project";
    EmbeddingService.initialize();
  });

  it("should initialize with GoogleAuth and project ID", () => {
    const auth = (EmbeddingService as any).auth;
    expect(auth).toBeDefined();
    expect(typeof auth.getClient).toBe("function");
    expect((EmbeddingService as any).projectId).toBe("mock-project");
  });

  it("should generate document embedding successfully", async () => {
    const result = await EmbeddingService.generateDocumentEmbedding(
      "hello world"
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("should use fallback when no embedding returned", async () => {
    const mockClient = {
      request: jest.fn().mockResolvedValue({ data: { predictions: [{}] } }),
    };
    (EmbeddingService as any).auth.getClient = jest
      .fn()
      .mockResolvedValue(mockClient);

    const result = await EmbeddingService.generateDocumentEmbedding(
      "test text"
    );
    expect(result).toHaveLength(768);
    expect(typeof result[0]).toBe("number");
  });

  it("should generate query embedding successfully", async () => {
    const result = await EmbeddingService.generateQueryEmbedding("query text");
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("should generate and store embedding successfully", async () => {
    jest
      .spyOn(EmbeddingService, "generateDocumentEmbedding")
      .mockResolvedValue([0.1, 0.2, 0.3]);
    await EmbeddingService.generateAndStore("mock-content", "text to embed");
    expect(EmbeddingsModel.create).toHaveBeenCalledWith({
      content_id: "mock-content",
      embedding: [0.1, 0.2, 0.3],
      text_content: "text to embed",
    });
  });

  it("should handle failure in generateAndStore", async () => {
    jest
      .spyOn(EmbeddingService, "generateDocumentEmbedding")
      .mockResolvedValue([0.5, 0.6]);
    (EmbeddingsModel.create as jest.Mock).mockRejectedValue(
      new Error("DB fail")
    );

    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await EmbeddingService.generateAndStore("bad-content", "broken text");
    expect(spy).toHaveBeenCalledWith(
      "Failed to store embedding:",
      expect.any(Error)
    );
    spy.mockRestore();
  });

  it("should return correct cosine similarity", () => {
    const a = [1, 0];
    const b = [1, 0];
    const result = EmbeddingService.cosineSimilarity(a, b);
    expect(result).toBeCloseTo(1);
  });

  it("should handle different lengths or zero magnitudes", () => {
    expect(EmbeddingService.cosineSimilarity([1, 2], [1])).toBe(0);
    expect(EmbeddingService.cosineSimilarity([], [])).toBe(0);
    expect(EmbeddingService.cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("should generate deterministic fallback embedding", () => {
    const result = (EmbeddingService as any).generateFallbackEmbedding(
      "sample text"
    );
    expect(result).toHaveLength(768);
    expect(result.some((v: number) => v !== 0)).toBe(true);
  });

  it("should hash strings deterministically", () => {
    const h1 = (EmbeddingService as any).hashString("abc");
    const h2 = (EmbeddingService as any).hashString("abc");
    expect(h1).toBe(h2);
    expect(typeof h1).toBe("number");
  });
});
