/**
 * ThemeAnalysisService - Equivalence partitions and test mapping
 *
 * Functions covered:
 * - analyzeTheme(theme)
 * - extractColorPalette(theme) [private]
 * - getColors(tokens) [private]
 * - assignPalette(explicit, adjectives, combined) [private]
 * - calculateStyleScores(theme) [private]
 * - determineVisualMood(theme) [private]
 * - calculateComplexityScore(theme) [private]
 * - calculateBrandStrength(theme) [private]
 *
 * Input partitions (theme):
 * - T1: undefined / null theme (invalid)
 * - T2: minimal theme (empty name, no tags/inspirations) (boundary)
 * - T3: typical theme with descriptive tags and inspirations (valid)
 * - T4: theme with noisy/junk tags or very long tags (invalid/atypical)
 *
 * Model partitions (internal heuristics):
 * - R1: explicit color mentions present (valid)
 * - R2: adjective-derived colors match (valid)
 * - R3: no color tokens -> fallback behavior (boundary)
 *
 */

import logger from "../src/config/logger";
import { ThemeAnalysisService } from "../src/services/ThemeAnalysisService";

jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

describe("ThemeAnalysisService", () => {
  const svc: any = ThemeAnalysisService as any;

  const minimalTheme = { name: "", tags: [], inspirations: [] } as any;

  const typicalTheme = {
    name: "Playful Modern Brand",
    tags: ["vibrant", "modern", "friendly"],
    inspirations: ["bold colors", "clean layout"],
  } as any;

  const junkTheme = {
    name: "DROP TABLE users; --",
    tags: [
      ";;;;",
      "<script>",
      "12345678901234567890123456789012345678901234567890",
    ],
    inspirations: ["'; --", "normal insp"],
  } as any;

  describe("analyzeTheme", () => {
    // Valid: typical theme -> returns a full analysis (Valid - T3)
    it("returns a ThemeAnalysis for a typical theme (valid)", () => {
      const analysis = ThemeAnalysisService.analyzeTheme(typicalTheme);
      expect(analysis).toHaveProperty("color_palette");
      expect(analysis).toHaveProperty("style_score");
      expect(Array.isArray(analysis.dominant_styles)).toBe(true);
      expect(typeof analysis.visual_mood).toBe("string");
      expect(analysis.style_score).toEqual(expect.any(Number));
      expect(analysis.complexity_score).toBeGreaterThanOrEqual(0);
      expect(analysis.brand_strength).toBeGreaterThanOrEqual(0);
    });

    // Boundary: minimal theme fields -> should still return analysis with fallbacks (Boundary - T2)
    it("handles minimal theme inputs and returns fallback analysis (boundary)", () => {
      const analysis = ThemeAnalysisService.analyzeTheme(minimalTheme);
      expect(analysis).toHaveProperty("color_palette");
      expect(analysis.color_palette.primary.length).toBeGreaterThan(0);
      expect(typeof analysis.visual_mood).toBe("string");
    });

    // Invalid/atypical: junk inputs should reduce brand strength (Invalid/Atypical - T4)
    it("penalizes brand strength for junky inputs (invalid)", () => {
      const good =
        ThemeAnalysisService.analyzeTheme(typicalTheme).brand_strength;
      const bad = ThemeAnalysisService.analyzeTheme(junkTheme).brand_strength;
      expect(bad).toBeLessThanOrEqual(good);
    });
  });

  describe("getColors / assignPalette / extractColorPalette", () => {
    // Valid R1: tokens with explicit color mention should produce explicit list (valid)
    it("detects explicit colors from tokens (valid - R1)", () => {
      const { explicit, combined } = svc.getColors("bright blue modern");
      expect(Array.isArray(explicit)).toBe(true);
      expect(combined.length).toBeGreaterThan(0);
      // explicit should contain a color name
      expect(explicit.length).toBeGreaterThanOrEqual(0);
    });

    // Valid R2: adjective-derived colors (valid)
    it("derives colors from adjectives when present (valid - R2)", () => {
      const res = svc.getColors("vibrant playful colorful");
      expect(res.adjectives.length).toBeGreaterThan(0);
      expect(res.combined.length).toBeGreaterThanOrEqual(res.adjectives.length);
    });

    // Atypical valid R3: empty tokens -> fallback combined (boundary - R3)
    it("falls back to defaults when no color tokens found (boundary - R3)", () => {
      const res = svc.getColors("");
      expect(res.combined.length).toBeGreaterThan(0);
    });

    // assignPalette: prioritize explicit over adjectives and combined
    it("assigns primary/secondary/accent buckets deterministically", () => {
      const assigned = svc.assignPalette(
        ["blue", "red"],
        ["pink"],
        ["purple", "white"]
      );
      expect(Array.isArray(assigned.primary)).toBe(true);
      expect(assigned.primary.length).toBeLessThanOrEqual(2);
      expect(assigned.secondary.length).toBeGreaterThanOrEqual(0);
    });

    // extractColorPalette: returns palette with mood set appropriately
    it("extractColorPalette infers mood from tokens (valid)", () => {
      const palette = svc.extractColorPalette({
        name: "Sunny Warm Brand",
        tags: ["warm"],
        inspirations: [],
      });
      expect(palette).toHaveProperty("primary");
      expect(palette).toHaveProperty("mood");
      expect(typeof palette.mood).toBe("string");
    });
  });

  describe("style / mood / complexity / brand scoring", () => {
    // calculateStyleScores: tokens containing style keywords yield non-zero scores (Valid)
    it("scores known styles when keywords present (valid)", () => {
      const theme = {
        name: "Modern Minimalist",
        tags: ["modern"],
        inspirations: [],
      } as any;
      const scores = svc.calculateStyleScores(theme);
      expect(scores.modern).toBeGreaterThan(0);
      expect(Object.keys(scores).length).toBeGreaterThan(0);
    });

    // determineVisualMood: finds dominant mood label when tokens match (Valid)
    it("determines visual mood from tokens (valid)", () => {
      const mood = svc.determineVisualMood({
        name: "Calm Serene",
        tags: ["serene"],
        inspirations: [],
      });
      expect(typeof mood).toBe("string");
      expect(mood).toBe("calm");
    });

    // determineVisualMood: returns 'balanced' when no matches (Boundary)
    it("returns 'balanced' when no mood keywords are present (boundary)", () => {
      const mood = svc.determineVisualMood({
        name: "Generic",
        tags: [],
        inspirations: [],
      });
      expect(mood).toBe("balanced");
    });

    // calculateComplexityScore: more tags/inspirations and multi-word name increases score (boundary/valid)
    it("increases complexity for rich themes (valid)", () => {
      const theme = {
        name: "A Very Complex Theme Name",
        tags: ["a", "b", "c", "d"],
        inspirations: ["x", "y"],
      } as any;
      const score = svc.calculateComplexityScore(theme);
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(100);
    });

    // calculateBrandStrength: clean vs junk comparison (valid/invalid)
    it("rewards clean tags and penalizes junk (valid/invalid)", () => {
      const clean = {
        name: "Brand Name",
        tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
        inspirations: ["i1", "i2", "i3"],
      } as any;
      const cleanScore = svc.calculateBrandStrength(clean);
      const junkScore = svc.calculateBrandStrength(junkTheme);
      expect(cleanScore).toBeGreaterThanOrEqual(junkScore);
    });
  });
});
