/**
 * PromptEnhancementService - Equivalence partitions and test mapping
 *
 * Units under test:
 * - enhancePromtWithRAG(userPrompt, ragContext, themeAnalysis)
 * - buildBrandedPrompt(params)
 * - scoreRagQuality(themeAnalysis, ragContext, promptLength)
 *
 * Partitions (inputs) — definitions:
 * - T1 (Valid): Typical valid inputs where all required fields are present and within expected ranges.
 * - T2 (Invalid): Inputs that are missing required fields, null/undefined where not allowed, or deliberately out-of-range.
 * - T3 (Atypical-but-valid): Edge/atypical inputs that are still valid (empty arrays, missing optional fields, multiple items).
 * - T4 (Boundary): Values exactly at decision thresholds (e.g., avgSimilarity 0.3/0.5/0.7, word count 20/80, complexity_score 70).
 *
 * Mapping (per-function):
 * - enhancePromtWithRAG:
 *   - T1: has RAG similarDescriptions and full theme palette/styles.
 *   - T3: no similarDescriptions; missing color_palette or dominant_styles; multiple dominant_styles (>2).
 *   - T2: undefined ragContext or undefined themeAnalysis.
 * - buildBrandedPrompt:
 *   - T1: full params present (userPrompt, projectName, projectDescription, themeInspirations, stylePreferences, targetAudience).
 *   - T3: empty themeInspirations; missing optional fields (stylePreferences/targetAudience); long inspiration arrays.
 *   - T2: empty userPrompt; missing projectName/projectDescription (treated tolerantly).
 * - scoreRagQuality:
 *   - T1: avgSimilarity > 0.7, promptLength producing wordCount in [20,80], complexity_score > 70.
 *   - T4: avgSimilarity exactly 0.7/0.5/0.3; wordCount exactly 20 or 80; complexity_score exactly 70.
 *   - T2: very short promptLength; negative brand_strength; extreme values triggering clamping.
 *
 */

import logger from "../src/config/logger";
import { PromptEnhancementService } from "../src/services/PromptEnhancementService";

// Silence logger in tests
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

describe("PromptEnhancementService (partitioned)", () => {
  describe("enhancePromtWithRAG", () => {
    const baseTheme = {
      color_palette: {
        primary: ["#ff0000"],
        secondary: ["#00ff00"],
        accent: ["#0000ff"],
      },
      visual_mood: "warm",
      dominant_styles: ["minimal", "modern"],
    } as any;

    const ragWithSimilar = {
      avgSimilarity: 0.8,
      similarDescriptions: ["a", "b"],
    } as any;
    const ragEmpty = { avgSimilarity: 0.1, similarDescriptions: [] } as any;

    // Valid typical input T1: — should contain user prompt, RAG hint, color phrase, mood and style
    it("produces an enhanced prompt when RAG context and theme are present (T1)", () => {
      const userPrompt = "A product hero image"; // tests T1
      const out = PromptEnhancementService.enhancePromtWithRAG(
        userPrompt,
        ragWithSimilar,
        baseTheme
      );
      expect(out).toContain(userPrompt);
      expect(out).toMatch(
        /drawing inspiration from previous successful content styles/
      );
      expect(out).toMatch(/featuring/);
      expect(out).toMatch(/with a warm atmosphere/);
      expect(out).toMatch(/in minimal and modern style/);
    });

    // Atypical valid T3: — no similarDescriptions => no RAG phrase
    it("omits RAG-derived phrase when no similar descriptions (T3)", () => {
      const out = PromptEnhancementService.enhancePromtWithRAG(
        "Title",
        ragEmpty,
        baseTheme
      );
      expect(out).not.toMatch(
        /drawing inspiration from previous successful content styles/
      );
      expect(out).toMatch(/featuring/);
    });

    // Atypical T3: — missing color palette and styles
    it("handles missing palette and styles without throwing (T3)", () => {
      const themeMissing = { visual_mood: "calm" } as any;
      const out = PromptEnhancementService.enhancePromtWithRAG(
        "Hello",
        ragEmpty,
        themeMissing
      );
      expect(out).toContain("Hello");
      // still includes mood
      expect(out).toMatch(/with a calm atmosphere/);
    });

    // atypical T3: — multiple (>2) dominant styles should format with commas and 'and'
    it("formats multiple dominant styles correctly (T3)", () => {
      const themeManyStyles = {
        ...baseTheme,
        dominant_styles: ["one", "two", "three"],
      } as any;
      const out = PromptEnhancementService.enhancePromtWithRAG(
        "X",
        ragEmpty,
        themeManyStyles
      );
      // Expect 'one, two and three' phrase
      expect(out).toMatch(/one, two and three/);
    });

    // invalid T2: — calling with undefined ragContext should throw (invalid input)
    it("throws if ragContext is undefined (invalid)", () => {
      expect(() =>
        // @ts-expect-error: deliberate invalid input
        PromptEnhancementService.enhancePromtWithRAG("p", undefined, baseTheme)
      ).toThrow();
    });

    // invalid T2: — calling with undefined themeAnalysis should throw (invalid)
    it("throws if themeAnalysis is undefined (invalid)", () => {
      expect(() =>
        // @ts-expect-error: deliberate invalid input
        PromptEnhancementService.enhancePromtWithRAG("p", ragEmpty, undefined)
      ).toThrow();
    });
  });

  describe("buildBrandedPrompt", () => {
    const goodParams = {
      userPrompt: "Showcase product",
      projectName: "Acme",
      projectDescription: "A modern widget",
      themeInspirations: ["brandA", "brandB"],
      stylePreferences: {
        composition: "centered",
        lighting: "soft",
        avoid: "low quality",
      },
      targetAudience: "developers",
    } as any;

    // T1: full params -> prompt contains inspirations, composition, lighting and negativePrompt includes global negatives
    it("builds a branded prompt with full params (T1)", () => {
      const out = PromptEnhancementService.buildBrandedPrompt(goodParams);
      expect(out.prompt).toContain(goodParams.userPrompt);
      expect(out.prompt).toMatch(/inspired by brandA and brandB/);
      expect(out.prompt).toMatch(/for Acme: A modern widget/);
      expect(out.prompt).toMatch(/designed for developers audience/);
      expect(out.prompt).toMatch(/centered composition/);
      expect(out.prompt).toMatch(/soft lighting/);
      expect(out.negativePrompt).toMatch(/low quality/);
    });

    // T3: empty themeInspirations -> no 'inspired by' fragment
    it("omits inspiration phrase when themeInspirations empty (T3)", () => {
      const p = { ...goodParams, themeInspirations: [] };
      const out = PromptEnhancementService.buildBrandedPrompt(p);
      expect(out.prompt).not.toMatch(/inspired by/);
      expect(out.prompt).toMatch(/for Acme: A modern widget/);
      // targetAudience defaults when missing
      const p2 = { ...p } as any;
      delete p2.targetAudience;
      const out2 = PromptEnhancementService.buildBrandedPrompt(p2);
      expect(out2.prompt).toMatch(/designed for general audience/);
    });

    // Invalid T2: missing userPrompt — still composes but userPrompt empty
    it("handles empty userPrompt without throwing (T2)", () => {
      const p = { ...goodParams, userPrompt: "" } as any;
      const out = PromptEnhancementService.buildBrandedPrompt(p);
      // prompt shouldn't be empty because projectName/description present
      expect(out.prompt.length).toBeGreaterThan(0);
    });

    // atypical T3: — more than 2 themeInspirations should only include first two in 'inspired by'
    it("limits inspirations to first two entries when many provided (T3)", () => {
      const p = {
        ...goodParams,
        themeInspirations: ["a", "b", "c", "d"],
      } as any;
      const out = PromptEnhancementService.buildBrandedPrompt(p);
      expect(out.prompt).toMatch(/inspired by a and b/);
      expect(out.prompt).not.toMatch(/inspired by a and b and c/);
    });

    // invalid T2: — missing projectName or projectDescription should not throw but will produce strings; ensure no exception
    it("does not throw when projectName or projectDescription are missing (T2)", () => {
      const p1 = { ...goodParams } as any;
      delete p1.projectName;
      delete p1.projectDescription;
      expect(() =>
        PromptEnhancementService.buildBrandedPrompt(p1)
      ).not.toThrow();
    });
  });

  describe("scoreRagQuality", () => {
    const baseTheme = { brand_strength: 30, complexity_score: 80 } as any;
    const ragHigh = { avgSimilarity: 0.75, similarDescriptions: ["x"] } as any;
    const ragMid = { avgSimilarity: 0.6, similarDescriptions: [] } as any;
    const ragLow = { avgSimilarity: 0.2, similarDescriptions: [] } as any;

    // T1: avgSimilarity > 0.7, good brand and complexity, promptLength yields wordCount in [20,80]
    it("awards a high score for strong similarity and good theme (T1)", () => {
      // compute expected: base 50 + brand_strength*0.2 +15 (sim>0.7) +10 (wordCount) +5 (complexity>70)
      const promptLength = 5 * 30; // ~30 words
      const expected = Math.max(
        0,
        Math.min(100, Math.round(50 + 30 * 0.2 + 15 + 10 + 5))
      );
      const score = PromptEnhancementService.scoreRagQuality(
        baseTheme,
        ragHigh,
        promptLength
      );
      expect(score).toBe(expected);
    });

    // T4: boundary avgSimilarity == 0.7 -> should follow >0.5 branch (+10), not +15
    it("uses the correct similarity bucket at boundary (avgSimilarity == 0.7) (T4)", () => {
      const theme = { brand_strength: 0, complexity_score: 0 } as any;
      const ragBoundary = {
        avgSimilarity: 0.7,
        similarDescriptions: [],
      } as any;
      const promptLength = 5 * 10; // 10 words -> no wordCount bonus
      const score = PromptEnhancementService.scoreRagQuality(
        theme,
        ragBoundary,
        promptLength
      );
      // base 50 + 10 (avgSim 0.7 -> >0.5 branch) = 60
      expect(score).toBe(60);
    });

    // T2: very short promptLength -> no wordCount bonus
    it("gives no word count bonus for very short prompts (T2)", () => {
      const scoreShort = PromptEnhancementService.scoreRagQuality(
        { brand_strength: 0 } as any,
        ragMid,
        5
      );
      // base 50 + 10 (avgSim 0.6) = 60
      expect(scoreShort).toBe(60);
    });

    // T2: negative brand_strength clamps at 0 (ensure not negative output)
    it("clamps low scores at 0 when theme brand_strength is very negative (T2)", () => {
      const themeNeg = { brand_strength: -1000, complexity_score: 0 } as any;
      const score = PromptEnhancementService.scoreRagQuality(
        themeNeg,
        ragLow,
        1
      );
      expect(score).toBeGreaterThanOrEqual(0);
    });

    // T4: boundary avgSimilarity == 0.5 -> should fall into >0.3 bucket (+5)
    it("uses the correct similarity bucket at boundary (avgSimilarity == 0.5) (T4)", () => {
      const theme = { brand_strength: 0, complexity_score: 0 } as any;
      const ragBoundary = {
        avgSimilarity: 0.5,
        similarDescriptions: [],
      } as any;
      const score = PromptEnhancementService.scoreRagQuality(
        theme,
        ragBoundary,
        0
      );
      // base 50 + 5 (avgSim 0.5 -> >0.3 branch) = 55
      expect(score).toBe(55);
    });

    // T4: boundary avgSimilarity == 0.3 -> should get no similarity bonus
    it("gives no similarity bonus at avgSimilarity == 0.3 (T4)", () => {
      const theme = { brand_strength: 0, complexity_score: 0 } as any;
      const ragBoundary = {
        avgSimilarity: 0.3,
        similarDescriptions: [],
      } as any;
      const score = PromptEnhancementService.scoreRagQuality(
        theme,
        ragBoundary,
        0
      );
      // base 50, no sim bonus
      expect(score).toBe(50);
    });

    // T4: word count boundaries exactly at 20 and 80 should give wordCount bonus
    it("gives wordCount bonus at 20 and 80 words boundaries (T4)", () => {
      const theme = { brand_strength: 0, complexity_score: 0 } as any;
      const rag = { avgSimilarity: 0 } as any;
      const score20 = PromptEnhancementService.scoreRagQuality(
        theme,
        rag,
        20 * 5
      );
      const score80 = PromptEnhancementService.scoreRagQuality(
        theme,
        rag,
        80 * 5
      );
      // both should receive +10
      expect(score20).toBe(60);
      expect(score80).toBe(60);
    });

    // T4: complexity_score == 70 should NOT give complexity bonus; 71 should
    it("gives complexity bonus only when complexity_score > 70 (T4)", () => {
      const rag = { avgSimilarity: 0 } as any;
      const s70 = PromptEnhancementService.scoreRagQuality(
        { complexity_score: 70 } as any,
        rag,
        0
      );
      const s71 = PromptEnhancementService.scoreRagQuality(
        { complexity_score: 71 } as any,
        rag,
        0
      );
      expect(s70).toBe(50);
      expect(s71).toBe(55);
    });

    // T4: ensure upper clamp at 100 for excessive inputs
    it("clamps the score to 100 when inputs produce >100 (T4)", () => {
      const themeHuge = { brand_strength: 1000, complexity_score: 1000 } as any;
      const ragHigh2 = { avgSimilarity: 0.9 } as any;
      const score = PromptEnhancementService.scoreRagQuality(
        themeHuge,
        ragHigh2,
        1000
      );
      expect(score).toBe(100);
    });
  });
});
