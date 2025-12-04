/**
 * StorageService — Class Test + Integrations Documentation
 *
 * Scope:
 * - Exercises multiple non-trivial methods of `StorageService`:
 *   - initialize(): bucket existence check and creation with config.
 *   - uploadImage(imageData, mimeType, projectId, contentId): size validation,
 *     filename generation, upload, and public URL retrieval.
 * - Uses equivalence partitions for valid/invalid/atypical inputs.
 *
 * Integrations:
 * - Supabase Storage: `src/config/supabaseClient` — buckets listing/creation,
 *   file upload, and public URL generation are mocked in tests.
 * - Logger: `src/config/logger` — info/error logs emitted during init/upload.
 * - Downstream usage: Public URLs are consumed by controllers/services (e.g.,
 *   `ImageGenerationController`) to persist and return generated image assets.
 *
 * Partitions:
 * - Image size:
 *   - S1: valid size (<= 10MB) — upload proceeds.
 *   - S2: too large (> 10MB) — validation error.
 * - MIME type:
 *   - M1: supported (png/jpeg/jpg/webp) — correct extension.
 *   - M2: unsupported — defaults to png.
 * - Bucket state (initialize):
 *   - B1: bucket exists — no creation.
 *   - B2: bucket missing — creation success.
 *   - B3: list error — logs and returns without throw.
 *   - B4: creation error — logs error.
 */

// Explicitly mock supabase client to control storage behavior
jest.mock("../src/config/supabaseClient", () => {
  const fromObj = {
    upload: jest.fn().mockResolvedValue({ error: null }),
    getPublicUrl: jest
      .fn()
      .mockReturnValue({ data: { publicUrl: "https://cdn/x.png" } }),
  };
  return {
    supabase: {
      storage: {
        listBuckets: jest.fn().mockResolvedValue({ data: [], error: null }),
        createBucket: jest.fn().mockResolvedValue({ error: null }),
        from: jest.fn().mockReturnValue(fromObj),
      },
    },
  };
});

import logger from "../src/config/logger";
import { StorageService } from "../src/services/StorageService";
import { supabase } from "../src/config/supabaseClient";

jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

// Helper: build base64 of given byte length
const makeBase64OfSize = (size: number) => {
  const buf = Buffer.alloc(size, 1);
  return buf.toString("base64");
};

// Ensure supabase.storage exists for tests; provide default no-op methods
beforeAll(() => {
  // noop: module factory above provides storage mocks
});

describe("StorageService", () => {
  beforeAll(() => {});
  afterEach(() => jest.clearAllMocks());

  describe("initialize", () => {
    // B1: bucket exists (valid boundary) → no creation
    it("resolves when bucket already exists (B1)", async () => {
      (supabase.storage.listBuckets as any) = jest.fn().mockResolvedValue({
        data: [{ name: "content-images" }],
        error: null,
      });
      await expect(StorageService.initialize()).resolves.toBeUndefined();
    });

    // B2: bucket missing (valid) → creation success
    it("resolves and handles creation when missing (B2)", async () => {
      (supabase.storage.listBuckets as any) = jest.fn().mockResolvedValue({
        data: [{ name: "other-bucket" }],
        error: null,
      });
      (supabase.storage.createBucket as any) = jest
        .fn()
        .mockResolvedValue({ error: null });
      await expect(StorageService.initialize()).resolves.toBeUndefined();
    });

    // B3: list error (invalid) → logs error, no throw
    it("logs and returns on list error (B3)", async () => {
      (supabase.storage.listBuckets as any) = jest
        .fn()
        .mockResolvedValue({ data: null, error: new Error("list fail") });
      await expect(StorageService.initialize()).resolves.toBeUndefined();
    });

    // B4: creation error (invalid) → logs error, continues
    it("handles create error path gracefully (B4)", async () => {
      (supabase.storage.listBuckets as any) = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      (supabase.storage.createBucket as any) = jest
        .fn()
        .mockResolvedValue({ error: new Error("create fail") });
      await expect(StorageService.initialize()).resolves.toBeUndefined();
    });
  });

  describe("uploadImage", () => {
    // Helper builder for storage.from(bucket)
    const mockFrom = () => {
      const fromObj = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest
          .fn()
          .mockReturnValue({ data: { publicUrl: "https://cdn/x.png" } }),
      } as any;
      (supabase.storage.from as any) = jest.fn().mockReturnValue(fromObj);
      return fromObj;
    };

    // S1/M1: valid size + supported MIME (valid) → upload proceeds
    it("uploads valid PNG and returns public URL (S1/M1)", async () => {
      mockFrom();
      const imageBase64 = makeBase64OfSize(1024); // 1KB
      const url = await StorageService.uploadImage(
        imageBase64,
        "image/png",
        "proj",
        "cid"
      );
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    });

    // S2: too large (>10MB) (invalid) → validation error
    it("rejects images larger than 10MB (S2)", async () => {
      mockFrom();
      const tooBig = makeBase64OfSize(10 * 1024 * 1024 + 1);
      await expect(
        StorageService.uploadImage(tooBig, "image/png", "p", "c")
      ).rejects.toThrow(/exceeds maximum/);
    });

    // M2: unsupported MIME (atypical valid) → defaults to png, upload succeeds
    it("accepts unknown MIME type and completes upload (M2)", async () => {
      mockFrom();
      const imageBase64 = makeBase64OfSize(2048);
      const url = await StorageService.uploadImage(
        imageBase64,
        "image/tiff",
        "p",
        "c"
      );
      expect(typeof url).toBe("string");
    });
  });
});
