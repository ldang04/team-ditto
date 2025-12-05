/**
 * Storage Service — Integration Tests (no mocks)
 *
 * Integrates:
 * - StorageService.initialize: bucket validation + creation with Supabase Storage.
 * - StorageService.uploadImage: image buffer handling, size validation, file upload, URL generation.
 * - Real Supabase Storage bucket for file persistence.
 *
 * External:
 * - Supabase Storage API for bucket operations and file uploads.
 * - Real file system buffering and Base64 encoding.
 * - Crypto module for secure random filename generation.
 */

import { StorageService } from "../../src/services/StorageService";
import { supabase } from "../../src/config/supabaseClient";

describe("Storage Service Integration", () => {
  jest.setTimeout(60000);

  /**
   * Integrates: StorageService.initialize → Supabase Storage bucket API.
   * External: Supabase Storage listBuckets, createBucket operations.
   * Validates: bucket exists or is successfully created.
   */
  it("initializes storage bucket", async () => {
    await expect(StorageService.initialize()).resolves.toBeUndefined();

    // Verify bucket exists by attempting to list
    const { data: buckets, error } = await supabase.storage.listBuckets();
    expect(error).toBeNull();
    expect(Array.isArray(buckets)).toBe(true);
    const bucketExists = buckets?.some((b) => b.name === "content-images");
    expect(bucketExists).toBe(true);
  });

  /**
   * Integrates: StorageService.uploadImage → Supabase Storage file upload + public URL generation.
   * External: Supabase Storage upload, getPublicUrl, real Base64 image data processing.
   * Validates: PNG image uploads successfully and returns accessible public URL.
   */
  it("uploads valid PNG image and returns public URL", async () => {
    // Create a minimal valid PNG (1x1 red pixel in Base64)
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHoAFhAJ/wlseKgAAAABJRU5ErkJggg==";

    const url = await StorageService.uploadImage(
      pngBase64,
      "image/png",
      "test-project",
      "test-content"
    );

    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
    expect(url).toMatch(/https?:\/\//);
    expect(url).toContain("content-images");
  });

  /**
   * Integrates: StorageService.uploadImage with oversized image.
   * External: File size validation before upload.
   * Validates: rejects images exceeding 10MB limit.
   */
  it("rejects images exceeding 10MB size limit", async () => {
    // Create buffer larger than 10MB
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
    const largeBase64 = largeBuffer.toString("base64");

    await expect(
      StorageService.uploadImage(
        largeBase64,
        "image/png",
        "test-project",
        "test-oversized"
      )
    ).rejects.toThrow(/exceeds maximum/);
  });

  /**
   * Integrates: StorageService.uploadImage with multiple uploads.
   * External: Supabase Storage handling concurrent file uploads.
   * Validates: concurrent uploads generate unique filenames.
   */
  it("generates unique filenames for concurrent uploads", async () => {
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHoAFhAJ/wlseKgAAAABJRU5ErkJggg==";

    const urls = await Promise.all([
      StorageService.uploadImage(
        pngBase64,
        "image/png",
        "project-concurrent",
        "content-same"
      ),
      StorageService.uploadImage(
        pngBase64,
        "image/png",
        "project-concurrent",
        "content-same"
      ),
      StorageService.uploadImage(
        pngBase64,
        "image/png",
        "project-concurrent",
        "content-same"
      ),
    ]);

    // All should succeed with different URLs
    urls.forEach((url) => {
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    });

    // Verify all URLs are unique
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(3);
  });
});
