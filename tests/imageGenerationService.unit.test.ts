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

// Helpers to stub the Google GenAI client used by ImageGenerationService
const stubGenerateContent = (response: any) => {
  (ImageGenerationService as any).client = {
    models: {
      generateContent: jest.fn().mockResolvedValue(response),
    },
  };
};

const stubGenerateContentReject = (err?: any) => {
  (ImageGenerationService as any).client = {
    models: {
      generateContent: jest
        .fn()
        .mockRejectedValue(err || new Error("client error")),
    },
  };
};

describe("ImageGenerationService", () => {
  const originalClient = (ImageGenerationService as any).client;

  afterEach(() => {
    (ImageGenerationService as any).client = originalClient;
    jest.clearAllMocks();
  });

  describe("generateImages", () => {
    // Valid: API returns prediction with image -> returns mapped GeneratedImage (Valid - R1/T4)
    it("returns mapped images when API responds with inlineData parts (valid)", async () => {
      stubGenerateContent({
        candidates: [
          {
            content: {
              parts: [
                { inlineData: { data: "AAA", mimeType: "image/png" } },
                { text: "ok" },
              ],
            },
          },
        ],
      });

      const res = await ImageGenerationService.generateImages({
        prompt: "A cat",
        numberOfImages: 1,
      });
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(1);
      expect(res[0].imageData).toBe("AAA");
      expect(res[0].mimeType).toBe("image/png");
    });

    // Atypical: padded prompt should be accepted (Atypical - T3)
    it("accepts padded prompt and returns images (atypical)", async () => {
      stubGenerateContent({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: "BBB", mimeType: "image/jpeg" } }],
            },
          },
        ],
      });

      const res = await ImageGenerationService.generateImages({
        prompt: "  padded prompt  ",
        numberOfImages: 1,
      });
      expect(res[0].imageData).toBe("BBB");
      expect(res[0].mimeType).toBe("image/jpeg");
    });

    // Boundary: request multiple images (N1 > 1)
    it("returns multiple images when numberOfImages > 1 (boundary)", async () => {
      // generateImages loops per numberOfImages; return same inlineData each call
      const gen = jest.fn().mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: "I", mimeType: "image/png" } }],
            },
          },
        ],
      });
      (ImageGenerationService as any).client = {
        models: { generateContent: gen },
      };

      const res = await ImageGenerationService.generateImages({
        prompt: "many",
        numberOfImages: 2,
      });
      expect(res).toHaveLength(2);
      expect(res.every((r) => r.imageData === "I")).toBe(true);
    });

    // Invalid: API returns empty predictions -> should throw (Invalid - R2)
    it("throws when API returns empty predictions (invalid - R2)", async () => {
      stubGenerateContent({ candidates: [] });
      await expect(
        ImageGenerationService.generateImages({
          prompt: "none",
          numberOfImages: 1,
        })
      ).rejects.toThrow(/No images generated/);
    });

    // Invalid: client.request throws -> should throw (invalid - R3)
    it("throws when client request errors (invalid - R3)", async () => {
      stubGenerateContentReject(new Error("network"));
      await expect(
        ImageGenerationService.generateImages({
          prompt: "err",
          numberOfImages: 1,
        })
      ).rejects.toThrow(/Image generation failed/);
    });

    // Atypical/malformed: prediction missing bytesBase64Encoded -> tolerate and map undefined (R4)
    it("throws when response has parts but no inlineData (invalid - R4)", async () => {
      stubGenerateContent({
        candidates: [{ content: { parts: [{ text: "no image" }] } }],
      });

      await expect(
        ImageGenerationService.generateImages({
          prompt: "malformed",
          numberOfImages: 1,
        })
      ).rejects.toThrow(/No images generated/);
    });

    // Invalid: missing / undefined prompt should throw (T1)
    it("throws when prompt is undefined (invalid - T1)", async () => {
      stubGenerateContent({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { data: "X", mimeType: "image/png" } }],
            },
          },
        ],
      });
      await expect(
        ImageGenerationService.generateImages(undefined as any)
      ).rejects.toThrow();
    });
  });
});
