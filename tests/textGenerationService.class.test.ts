/**
 * TextGenerationService — Class Test + Integrations Documentation
 *
 * Scope:
 * - Exercises `TextGenerationService.generateContent(params)` with multiple
 *   non-trivial behaviors: marker parsing, paragraph fallback, variant
 *   slicing, and error handling.
 *
 * Integrations:
 * - Logger: `src/config/logger` — initialization and generation logs.
 * - Provider client: Underlying GenAI model accessed via
 *   `TextGenerationService.model.generateContent`; tests stub model calls to
 *   avoid external API usage.
 * - Downstream usage: Generated text variants are consumed by controllers
 *   (e.g., `TextGenerationController`) and the `ContentGenerationPipeline`
 *   to persist variants, compute quality scores, and select top results.
 *
 * Input partitions (params.prompt / params.variantCount / params.media_type):
 * - T1: missing / undefined prompt (invalid)
 * - T2: empty string prompt (boundary)
 * - T3: padded/whitespace-only prompt (atypical)
 * - T4: normal non-empty prompt (valid)
 * - V1: variantCount = 0 (boundary)
 * - V2: variantCount = 1..N (valid)
 * - V3: variantCount > generated variants (above available)
 *
 * Model response partitions:
 * - R1: text with markers ---VARIANT_START--- / ---VARIANT_END--- (valid)
 * - R2: text without markers but with paragraph separators (fallback)
 * - R3: no candidates / empty -> fallback to default text
 * - R4: model.generateContent throws -> service error
 *
 * Mapping -> tests:
 * - Marker parsing: R1 with variantCount slicing
 * - Paragraph fallback: R2 without markers
 * - Boundaries: V1/V3 for counts
 * - Invalid inputs: T1/T2/T3
 * - Error path: R4 rejection
 */

// Ensure VertexAI initialization has a project id during tests
process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import logger from "../src/config/logger";
import { TextGenerationService } from "../src/services/TextGenerationService";

jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

describe("TextGenerationService", () => {
  const originalModel = (TextGenerationService as any).model;

  afterEach(() => {
    jest.clearAllMocks();
    (TextGenerationService as any).model = originalModel;
  });

  const stubModelResponse = (text: string | null) => {
    (TextGenerationService as any).model = {
      generateContent: jest
        .fn()
        .mockResolvedValue(
          text
            ? { response: { candidates: [{ content: { parts: [{ text }] } }] } }
            : { response: {} }
        ),
    };
  };

  const stubModelReject = (err?: any) => {
    (TextGenerationService as any).model = {
      generateContent: jest
        .fn()
        .mockRejectedValue(err || new Error("model fail")),
    };
  };

  const baseParams = {
    project: {
      name: "P",
      description: "D",
      goals: "G",
      customer_type: "C",
    } as any,
    theme: { name: "T", font: "F", tags: [], inspirations: [] } as any,
    style_preferences: {},
    target_audience: "general",
    media_type: "text",
  } as any;

  describe("generateContent", () => {
    // Valid: markers present -> extracts variants and slices to variantCount (Valid - R1)
    it("extracts variants when markers present and respects variantCount (valid)", async () => {
      const generated = `---VARIANT_START---First---VARIANT_END---\n---VARIANT_START---Second---VARIANT_END---\n---VARIANT_START---Third---VARIANT_END---`;
      stubModelResponse(generated);

      const params = { ...baseParams, prompt: "hello", variantCount: 2 } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toHaveLength(2);
      expect(res[0]).toBe("First");
      expect(res[1]).toBe("Second");
    });

    // Atypical: padded prompt -> still accepted and parsed (Atypical - T3)
    it("accepts padded prompt and returns variants (atypical)", async () => {
      const generated = `---VARIANT_START---Only---VARIANT_END---`;
      stubModelResponse(generated);
      const params = {
        ...baseParams,
        prompt: "  padded  ",
        variantCount: 1,
      } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toEqual(["Only"]);
    });

    // Fallback: no markers but paragraphs separated by double newline -> fallback parsing (R2)
    it("falls back to paragraph splitting when markers absent (fallback - R2)", async () => {
      const generated = `Paragraph one.\n\nParagraph two.`;
      stubModelResponse(generated);
      const params = { ...baseParams, prompt: "p", variantCount: 3 } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toEqual(["Paragraph one.", "Paragraph two."]);
    });

    // Boundary: variantCount = 0 -> returns empty array (Boundary - V1)
    it("returns empty array when variantCount is 0 (boundary)", async () => {
      const generated = `---VARIANT_START---One---VARIANT_END---`;
      stubModelResponse(generated);
      const params = { ...baseParams, prompt: "p", variantCount: 0 } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toEqual([]);
    });

    // Above available: variantCount > generated -> returns only available variants (V3)
    it("returns only available variants when variantCount exceeds generated (boundary)", async () => {
      const generated = `---VARIANT_START---A---VARIANT_END---`;
      stubModelResponse(generated);
      const params = { ...baseParams, prompt: "p", variantCount: 5 } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toEqual(["A"]);
    });

    // Invalid: model.generateContent throws -> service throws (Error - R4)
    it("throws when underlying model generation fails (invalid - R4)", async () => {
      stubModelReject(new Error("boom"));
      const params = { ...baseParams, prompt: "p", variantCount: 1 } as any;
      await expect(
        TextGenerationService.generateContent(params)
      ).rejects.toThrow(/TextGenerationService generation failed/);
    });

    // Invalid: undefined prompt -> service still calls model and returns (T1)
    it("handles undefined prompt without throwing (invalid - T1)", async () => {
      const generated = `---VARIANT_START---U---VARIANT_END---`;
      stubModelResponse(generated);
      const params = {
        ...baseParams,
        prompt: undefined as any,
        variantCount: 1,
      } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toEqual(["U"]);
    });

    // Invalid: empty string prompt -> model still called; behavior depends on model (T2)
    it("accepts empty string prompt (boundary - T2)", async () => {
      const generated = `Generated content without markers`;
      stubModelResponse(generated);
      const params = { ...baseParams, prompt: "", variantCount: 1 } as any;
      const res = await TextGenerationService.generateContent(params);
      expect(res).toEqual(["Generated content without markers"]);
    });
  });
});
