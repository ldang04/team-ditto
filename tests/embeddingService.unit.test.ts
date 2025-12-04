/**
 * EmbeddingService - Equivalence partitions and test mapping
 *
 * Inputs / partitions (text / image inputs):
 * - T1: missing / undefined input (invalid)
 * - T2: empty string ('') (boundary -> often triggers fallback)
 * - T3: whitespace-only ('   ') (atypical-valid -> normalize/trim)
 * - T4: normal non-empty string (valid -> calls remote API)
 * - T5: non-string types (invalid)
 *
 * Client / API response partitions:
 * - R1: API returns valid embedding array (valid)
 * - R2: API returns empty embedding array (invalid response -> fallback)
 * - R3: client.request throws/rejects (error -> fallback)
 * - R4: malformed API response (missing expected property -> fallback)
 *
 * Store partitions (persistence):
 * - S1: store succeeds (valid)
 * - S2: store fails / rejects (invalid store but embedding should still be returned)
 *
 * Cosine partitions:
 * - C1: equal non-zero vectors -> similarity = 1 (valid)
 * - C2: differing lengths -> treated as incompatible -> returns 0 (invalid)
 * - C3: zero-vector present -> returns 0 (boundary)
 * - C4: normal different vectors -> similarity in (-1,1) (valid)
 *
 * Fallback properties (F1): deterministic, normalized, length 768
 *
 * Mapping -> which tests exercise which partitions:
 * - generateDocumentEmbedding:
 *   - valid API: returns API embedding -> R1, T4
 *   - empty string: empty -> T2, R2
 *   - client error: T4/R3
 *   - malformed response: R4
 * - generateQueryEmbedding:
 *   - padded input: T3
 *   - empty/empty API: T2/R2
 *   - client error: R3
 * - generateImageEmbedding:
 *   - padded base64: T3
 *   - client error / malformed response: R3 / R4
 * - generateMultimodalTextEmbedding:
 *   - normal input: R1/T4
 *   - empty API response: R2
 *   - client error: R3
 *   - undefined input: T1
 * - generateAndStoreText / generateAndStoreImage:
 *   - successful store: S1
 *   - store rejects: S2 (embedding still returned)
 *   - client errors -> fallback: R3
 * - generateFallbackEmbedding:
 *   - determinism & normalization tests: F1
 * - cosineSimilarity:
 *   - identical vectors C1, different lengths C2, zero vector C3, different vectors C4
 *
 * Each `it()` is annotated in-line with the partition it targets (Valid / Invalid / Atypical).
 */

import logger from "../src/config/logger";
import { EmbeddingService } from "../src/services/EmbeddingService";
import { EmbeddingsModel } from "../src/models/EmbeddingsModel";

jest.mock("../src/models/EmbeddingsModel");
jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "warn").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

// Helpers to centralize stubbing of the GoogleAuth client used by EmbeddingService
const stubClientResponse = (data: any) => {
  (EmbeddingService as any).auth = {
    getClient: jest
      .fn()
      .mockResolvedValue({ request: jest.fn().mockResolvedValue({ data }) }),
  };
};

const stubClientReject = (err?: any) => {
  (EmbeddingService as any).auth = {
    getClient: jest.fn().mockResolvedValue({
      request: jest.fn().mockRejectedValue(err || new Error("client error")),
    }),
  };
};

const stubGetClientRejectAll = (err?: any) => {
  (EmbeddingService as any).auth = {
    getClient: jest.fn().mockRejectedValue(err || new Error("no client")),
  };
};

describe("EmbeddingService", () => {
  const originalAuth = (EmbeddingService as any).auth;

  afterEach(() => {
    // restore auth stub between tests
    (EmbeddingService as any).auth = originalAuth;
    jest.clearAllMocks();
  });

  describe("generateDocumentEmbedding", () => {
    // Valid: API returns embedding -> returns API array
    it("returns API embedding when available (valid)", async () => {
      const apiEmbedding = [1, 2, 3];
      stubClientResponse({
        predictions: [{ embeddings: { values: apiEmbedding } }],
      });

      const result = await EmbeddingService.generateDocumentEmbedding(
        "Hello world"
      );
      expect(result).toBe(apiEmbedding);
    });

    // Atypical: empty text string -> ensure fallback when API returns none
    it("with empty string uses fallback (boundary)", async () => {
      stubClientResponse({ predictions: [{ embeddings: { values: [] } }] });

      const result = await EmbeddingService.generateDocumentEmbedding("");
      expect(result.length).toBe(768);
    });

    // Invalid: API returns empty embedding -> fallback used
    it("falls back when API returns empty (invalid response)", async () => {
      stubClientResponse({ predictions: [{ embeddings: { values: [] } }] });

      const result = await EmbeddingService.generateDocumentEmbedding(
        "No embed"
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768);
    });

    // Invalid: client.request throws -> fallback used
    it("falls back when client throws (error path)", async () => {
      stubClientReject(new Error("error"));

      const result = await EmbeddingService.generateDocumentEmbedding("Crash");
      expect(result.length).toBe(768);
    });

    // Invalid: malformed API response (missing embeddings) -> fallback
    it("falls back when API response is malformed (invalid - R4)", async () => {
      stubClientResponse({ predictions: [{}] });
      const result = await EmbeddingService.generateDocumentEmbedding(
        "malformed"
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768);
    });

    // Invalid: missing/undefined input for document embedding (T1)
    it("rejects when document input is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ embeddings: { values: [] } }] });
      await expect(
        EmbeddingService.generateDocumentEmbedding(undefined as any)
      ).rejects.toThrow();
    });
  });

  describe("generateQueryEmbedding", () => {
    // Valid: API returns embedding
    it("returns API embedding when available (valid)", async () => {
      const apiEmbedding = [0.1, 0.2, 0.3];
      stubClientResponse({
        predictions: [{ embeddings: { values: apiEmbedding } }],
      });

      const result = await EmbeddingService.generateQueryEmbedding(
        "query text"
      );
      expect(result).toBe(apiEmbedding);
    });

    // Atypical: padded input should be accepted and return API embedding (atypical)
    it("accepts padded input and returns API embedding (atypical)", async () => {
      const apiEmbedding = [0.7, 0.8, 0.9];
      stubClientResponse({
        predictions: [{ embeddings: { values: apiEmbedding } }],
      });

      const result = await EmbeddingService.generateQueryEmbedding(
        "  padded query  "
      );
      expect(result).toBe(apiEmbedding);
    });

    // Invalid: API returns empty embedding -> fallback
    it("falls back when API returns empty embedding (invalid)", async () => {
      stubClientResponse({ predictions: [{ embeddings: { values: [] } }] });

      const result = await EmbeddingService.generateQueryEmbedding("no-embed");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(768);
    });

    // Invalid: client error -> fallback
    it("falls back on client error (invalid)", async () => {
      stubGetClientRejectAll(new Error("no client"));
      const result = await EmbeddingService.generateQueryEmbedding("q");
      expect(result.length).toBe(768);
    });

    // Invalid: missing/undefined input for query embedding (T1)
    it("rejects when query input is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ embeddings: { values: [] } }] });
      await expect(
        EmbeddingService.generateQueryEmbedding(undefined as any)
      ).rejects.toThrow();
    });
  });

  describe("generateImageEmbedding", () => {
    // Valid: API returns image embedding
    it("returns API image embedding when available (valid)", async () => {
      const imgEmbedding = [9, 8, 7];
      stubClientResponse({ predictions: [{ imageEmbedding: imgEmbedding }] });

      const result = await EmbeddingService.generateImageEmbedding(
        "base64data"
      );
      expect(result).toBe(imgEmbedding);
    });

    // Atypical: base64 with surrounding spaces should be accepted (atypical)
    it("accepts base64 with surrounding spaces and returns API embedding (atypical)", async () => {
      const imgEmbedding = [5, 6, 7];
      stubClientResponse({ predictions: [{ imageEmbedding: imgEmbedding }] });

      const result = await EmbeddingService.generateImageEmbedding(
        "  YmFzZTY0  "
      );
      expect(result).toBe(imgEmbedding);
    });

    // Invalid: client error -> fallback
    it("falls back when client errors (invalid)", async () => {
      stubClientReject(new Error("img err"));
      const result = await EmbeddingService.generateImageEmbedding("base64");
      expect(result.length).toBe(1408);
    });

    // Invalid (R4): malformed API response (missing imageEmbedding) -> fallback
    it("falls back when API image response is malformed (invalid - R4)", async () => {
      stubClientResponse({ predictions: [{}] });
      const result = await EmbeddingService.generateImageEmbedding(
        "malformed-img"
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1408);
    });

    // Invalid: missing/undefined input for image embedding (T1)
    it("rejects when image input is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ imageEmbedding: [] }] });
      await expect(
        EmbeddingService.generateImageEmbedding(undefined as any)
      ).rejects.toThrow();
    });
  });

  describe("generateAndStoreText", () => {
    // Valid: persists embedding and returns it
    it("persists embedding and returns it (valid)", async () => {
      const apiEmbedding = [1, 1, 1];
      stubClientResponse({
        predictions: [{ embeddings: { values: apiEmbedding } }],
      });

      (EmbeddingsModel.create as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await EmbeddingService.generateAndStoreText(
        "cid1",
        "some text"
      );
      expect(result).toBe(apiEmbedding);
      expect(EmbeddingsModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ content_id: "cid1" })
      );
    });

    // Invalid: store failure tolerated; embedding still returned (invalid store)
    it("returns embedding even if store fails (invalid store)", async () => {
      const apiEmbedding = [2, 2, 2];
      stubClientResponse({
        predictions: [{ embeddings: { values: apiEmbedding } }],
      });

      (EmbeddingsModel.create as jest.Mock).mockRejectedValue(
        new Error("db fail")
      );

      const result = await EmbeddingService.generateAndStoreText(
        "cid2",
        "text"
      );
      expect(result).toBe(apiEmbedding);
      expect(EmbeddingsModel.create).toHaveBeenCalled();
    });

    // Invalid: missing/undefined for store text -> bubbling rejection (T1)
    it("rejects generateAndStoreText when text is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ embeddings: { values: [] } }] });
      await expect(
        EmbeddingService.generateAndStoreText("cid-x", undefined as any)
      ).rejects.toThrow();
    });
  });

  describe("generateAndStoreImage", () => {
    // Valid: persists image embedding and returns it
    it("persists image embedding and returns it (valid)", async () => {
      const imgEmbedding = [3, 3, 3];
      stubClientResponse({ predictions: [{ imageEmbedding: imgEmbedding }] });

      (EmbeddingsModel.create as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await EmbeddingService.generateAndStoreImage(
        "img1",
        "imgbase64"
      );
      expect(result).toBe(imgEmbedding);
      expect(EmbeddingsModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: "image" })
      );
    });

    // Invalid: client error -> fallback and storage attempted (invalid)
    it("falls back on client error and still attempts to store (invalid)", async () => {
      // stub client to reject quickly so fallback is used
      (EmbeddingService as any).auth = {
        getClient: jest.fn().mockResolvedValue({
          request: jest.fn().mockRejectedValue(new Error("img fail")),
        }),
      };

      // ensure model create is observed (service should attempt to store)
      (EmbeddingsModel.create as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await EmbeddingService.generateAndStoreImage(
        "img-invalid",
        "base64-or-invalid"
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1408);
      expect(EmbeddingsModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: "image" })
      );
    });

    // Invalid: missing/undefined for store image -> bubbling rejection (T1)
    it("rejects generateAndStoreImage when image is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ imageEmbedding: [] }] });
      await expect(
        EmbeddingService.generateAndStoreImage("img-x", undefined as any)
      ).rejects.toThrow();
    });

    // S2: store failure tolerated — should log error but still return embedding
    it("logs an error when storing image embedding fails but returns embedding (invalid store - S2)", async () => {
      const imgEmbedding = [4, 4, 4];
      stubClientResponse({ predictions: [{ imageEmbedding: imgEmbedding }] });

      (EmbeddingsModel.create as jest.Mock).mockRejectedValue(
        new Error("store fail")
      );

      const result = await EmbeddingService.generateAndStoreImage(
        "img-store-fail",
        "imgbase64"
      );

      expect(result).toBe(imgEmbedding);
      expect(EmbeddingsModel.create).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to store image embedding:",
        expect.any(Error)
      );
    });
  });

  describe("generateMultimodalTextEmbedding", () => {
    // Valid: API returns multimodal text embedding
    it("returns API multimodal text embedding when available (valid)", async () => {
      const mmEmbedding = new Array(1408).fill(0).map((_, i) => i % 5);
      stubClientResponse({ predictions: [{ textEmbedding: mmEmbedding }] });

      const result = await EmbeddingService.generateMultimodalTextEmbedding(
        "some text"
      );
      expect(result).toBe(mmEmbedding);
    });

    // Invalid: API returns empty -> fallback to 1408 dims
    it("falls back when API returns empty multimodal embedding (invalid)", async () => {
      stubClientResponse({ predictions: [{ textEmbedding: [] }] });

      const result = await EmbeddingService.generateMultimodalTextEmbedding(
        "empty"
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1408);
    });

    // Invalid: client error -> fallback
    it("falls back on client error (invalid)", async () => {
      stubClientReject(new Error("mm err"));
      const result = await EmbeddingService.generateMultimodalTextEmbedding(
        "q"
      );
      expect(result.length).toBe(1408);
    });

    // Invalid: undefined input -> rejects
    it("rejects when multimodal text input is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ textEmbedding: [] }] });
      await expect(
        EmbeddingService.generateMultimodalTextEmbedding(undefined as any)
      ).rejects.toThrow();
    });
  });

  describe("generateFallbackEmbedding (F1)", () => {
    // Valid: fallback returns deterministic result for same input (determinism)
    it("produces deterministic, normalized 768-dim vectors (valid - F1)", () => {
      const a = (EmbeddingService as any).generateFallbackEmbedding(
        "Hello World",
        768
      );
      const b = (EmbeddingService as any).generateFallbackEmbedding(
        "Hello World",
        768
      );
      expect(a).toHaveLength(768);
      expect(b).toHaveLength(768);
      // exact equality expected because implementation is deterministic
      expect(a).toEqual(b);

      // normalized magnitude ~1
      const mag = Math.sqrt(a.reduce((s: number, v: number) => s + v * v, 0));
      expect(mag).toBeCloseTo(1, 6);
    });

    // Valid: different inputs produce different embeddings (uniqueness)
    it("produces different vectors for different inputs (valid)", () => {
      const a = (EmbeddingService as any).generateFallbackEmbedding("one", 768);
      const b = (EmbeddingService as any).generateFallbackEmbedding("two", 768);
      // They should not be identical arrays
      expect(a).not.toEqual(b);
    });
  });

  describe("cosineSimilarity", () => {
    // Valid: equal non-zero vectors -> 1
    it("returns 1 for identical non-zero vectors (valid)", () => {
      const v = [1, 0, 0];
      const sim = EmbeddingService.cosineSimilarity(v, v);
      expect(sim).toBeCloseTo(1);
    });

    // Invalid: different-length vectors -> 0 (invalid)
    it("returns 0 for different length vectors (invalid)", () => {
      const a = [1, 2];
      const b = [1, 2, 3];
      expect(EmbeddingService.cosineSimilarity(a, b)).toBe(0);
    });

    // Atypical valid: zero vector present -> 0 (boundary)
    it("returns 0 if either vector has zero magnitude (boundary)", () => {
      const zero = [0, 0, 0];
      const v = [1, 2, 3];
      expect(EmbeddingService.cosineSimilarity(zero, v)).toBe(0);
      expect(EmbeddingService.cosineSimilarity(v, zero)).toBe(0);
    });

    // Valid: normal different vectors produce value in (-1,1)
    it("returns between -1 and 1 for different vectors (valid)", () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const sim = EmbeddingService.cosineSimilarity(a, b);
      expect(sim).toBeCloseTo(0);
    });
  });
});
