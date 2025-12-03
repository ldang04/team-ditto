/**
 * PromptEnhancementService - Equivalence partitions and test mapping
 *
 * Units under test:
 * - enhancePromtWithRAG(userPrompt, ragContext, themeAnalysis)
 * - buildBrandedPrompt(params)
 * - scoreRagQuality(themeAnalysis, ragContext, promptLength)
 *
 * Partitions (general):
 * - T1: valid / typical inputs — all required fields present and in expected ranges
 * - T2: invalid inputs — missing/empty required fields, or explicit error-triggering values
 * - T3: atypical valid inputs — boundary values, empty arrays, zero/edge numbers
 * - T4: boundary equality checks (at/above/below thresholds used by logic)
 *
 * Mapping (per-function):
 * - enhancePromtWithRAG:
 *   - existing similarDescriptions (T1)
 *   - no similarDescriptions (T3)
 *   - missing palette / missing styles (T3)
 * - buildBrandedPrompt:
 *   - full params (T1)
 *   - empty themeInspirations (T3)
 *   - missing optional fields (T3)
 * - scoreRagQuality:
 *   - avgSimilarity > 0.7 (T1)
 *   - avgSimilarity == 0.7 (boundary T4)
 *   - very short promptLength (T2)
 *   - negative brand_strength (T2, clamps at 0)
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

    // Valid typical inputT1:  — should contain user prompt, RAG hint, color phrase, mood and style
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

    // T2: missing userPrompt (invalid-ish) — still composes but userPrompt empty
    it("handles empty userPrompt without throwing (T2)", () => {
      const p = { ...goodParams, userPrompt: "" } as any;
      const out = PromptEnhancementService.buildBrandedPrompt(p);
      // prompt shouldn't be empty because projectName/description present
      expect(out.prompt.length).toBeGreaterThan(0);
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
  });
});
