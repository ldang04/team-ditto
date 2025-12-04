/**
 * ImageGenerationService - Equivalence partitions and test mapping
 *
 * Units under test:
 * - ImageGenerationService.generateImages(params)
 *
 * Inputs / partitions (prompt / params):
 * - T1: missing / undefined prompt (invalid)
 * - T2: empty string ('') prompt (boundary)
 * - T3: whitespace-only prompt (atypical-valid -> should be accepted)
 * - T4: normal non-empty prompt (valid)
 * - N1: numberOfImages: 1 (default) vs >1 (boundary / valid)
 *
 * Client / API response partitions:
 * - R1: API returns predictions array with image data (valid)
 * - R2: API returns empty predictions array (invalid -> throw)
 * - R3: client.request throws/rejects (invalid -> throw)
 * - R4: malformed prediction (missing bytesBase64Encoded) (atypical/invalid)
 *
 * Mapping -> which tests exercise which partitions:
 * - Valid/API: prediction -> R1, T4
 * - Empty prompt -> T2 (boundary) with R1 or R2
 * - Whitespace prompt -> T3 (atypical) exercising same mapping as T4
 * - Multiple images -> N1 >1 mapping tested
 * - R2/R3 -> tests asserting thrown errors
 * - R4 -> test asserting tolerant mapping (imageData undefined, mimeType defaulted)
 *
 */

import logger from "../src/config/logger";
import { ImageGenerationService } from "../src/services/ImageGenerationService";

jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

// Helpers to stub the GoogleAuth client used by ImageGenerationService
const stubClientResponse = (data: any) => {
  (ImageGenerationService as any).auth = {
    getClient: jest
      .fn()
      .mockResolvedValue({ request: jest.fn().mockResolvedValue({ data }) }),
  };
};

const stubClientReject = (err?: any) => {
  (ImageGenerationService as any).auth = {
    getClient: jest.fn().mockResolvedValue({
      request: jest.fn().mockRejectedValue(err || new Error("client error")),
    }),
  };
};

describe("ImageGenerationService", () => {
  const originalAuth = (ImageGenerationService as any).auth;

  afterEach(() => {
    (ImageGenerationService as any).auth = originalAuth;
    jest.clearAllMocks();
  });

  describe("generateImages", () => {
    // Valid: API returns prediction with image -> returns mapped GeneratedImage (Valid - R1/T4)
    it("returns mapped images when API responds with predictions (valid)", async () => {
      const preds = [
        { bytesBase64Encoded: "AAA", mimeType: "image/png", seed: 1 },
      ];
      stubClientResponse({ predictions: preds });

      const res = await ImageGenerationService.generateImages({
        prompt: "A cat",
      });
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
      expect(res[0].imageData).toBe("AAA");
      expect(res[0].mimeType).toBe("image/png");
      expect(res[0].seed).toBe(1);
    });

    // Atypical: padded prompt should be accepted (Atypical - T3)
    it("accepts padded prompt and returns images (atypical)", async () => {
      const preds = [{ bytesBase64Encoded: "BBB", mimeType: "image/jpeg" }];
      stubClientResponse({ predictions: preds });

      const res = await ImageGenerationService.generateImages({
        prompt: "  padded prompt  ",
      });
      expect(res[0].imageData).toBe("BBB");
      expect(res[0].mimeType).toBe("image/jpeg");
    });

    // Boundary: request multiple images (N1 > 1)
    it("returns multiple images when numberOfImages > 1 (boundary)", async () => {
      const preds = [
        { bytesBase64Encoded: "I1" },
        { bytesBase64Encoded: "I2" },
      ];
      stubClientResponse({ predictions: preds });

      const res = await ImageGenerationService.generateImages({
        prompt: "many",
        numberOfImages: 2,
      });
      expect(res).toHaveLength(2);
      expect(res.map((r) => r.imageData)).toEqual(["I1", "I2"]);
    });

    // Invalid: API returns empty predictions -> should throw (Invalid - R2)
    it("throws when API returns empty predictions (invalid - R2)", async () => {
      stubClientResponse({ predictions: [] });
      await expect(
        ImageGenerationService.generateImages({ prompt: "none" })
      ).rejects.toThrow(/No images generated/);
    });

    // Invalid: client.request throws -> should throw (invalid - R3)
    it("throws when client request errors (invalid - R3)", async () => {
      stubClientReject(new Error("network"));
      await expect(
        ImageGenerationService.generateImages({ prompt: "err" })
      ).rejects.toThrow(/Image generation failed/);
    });

    // Atypical/malformed: prediction missing bytesBase64Encoded -> tolerate and map undefined (R4)
    it("returns item with undefined imageData when prediction missing bytes (atypical - R4)", async () => {
      const preds = [{ mimeType: "image/png" }];
      stubClientResponse({ predictions: preds });

      const res = await ImageGenerationService.generateImages({
        prompt: "malformed",
      });
      expect(res).toHaveLength(1);
      expect(res[0].imageData).toBeUndefined();
      expect(res[0].mimeType).toBe("image/png");
    });

    // Invalid: missing / undefined prompt should throw (T1)
    it("throws when prompt is undefined (invalid - T1)", async () => {
      stubClientResponse({ predictions: [{ bytesBase64Encoded: "X" }] });
      await expect(
        ImageGenerationService.generateImages(undefined as any)
      ).rejects.toThrow();
    });
  });
});
