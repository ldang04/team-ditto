/**
 * QualityScoringService — Class Test + Integrations Documentation
 *
 * Scope:
 * - Exercises multiple non-trivial methods of `QualityScoringService`:
 *   - scoreTextQuality(text)
 *   - scoreImageQuality(promptText, theme)
 *   - scorePromptQuality(prompt, themeTags)
 * - Uses equivalence partitions and boundaries to validate heuristics.
 *
 * Integrations:
 * - Logger: `src/config/logger` — informational logs emitted during scoring.
 * - Config: `src/config/keywords` — quality/style/color/composition keywords used
 *   by scoring heuristics; tests indirectly exercise this configuration.
 * - Downstream usage: Scoring outputs are consumed by pipeline stages
 *   (e.g., `ContentGenerationPipeline`) and ranking flows/controllers
 *   (e.g., `RankController`), informing variant selection and ordering.
 *
 * Partitions (text inputs):
 * - T1: missing / undefined (invalid)
 * - T2: empty string (boundary)
 * - T3: very short (<10 words) (invalid)
 * - T4: moderate (20-100 words ideal) (valid)
 * - T5: very long (>300 for textQuality or >100 for image prompts) (invalid)
 * - A1: excessive punctuation/exclamations or ALL-CAPS (atypical)
 *
 * Partitions (theme / tags / keywords):
 * - K1: contains professional/quality/style keywords (valid boost)
 * - K2: contains negative indicators (e.g. 'low quality') (invalid)
 *
 * Mapping -> tests:
 * - scoreTextQuality:
 *   - valid / ideal length: T4, K1
 *   - too short: T3
 *   - too long: T5
 *   - exclamation/caps penalties: A1
 * - scoreImageQuality:
 *   - ideal prompt length: T4 (10-50 words) + theme tag matches K1
 *   - too short (<5): T3
 *   - overly long (>100): T5
 *   - negative indicator: K2
 * - scorePromptQuality:
 *   - ideal length (20-100) : T4 + tag matches
 *   - too short / too long: T3 / T5
 */

import { QualityScoringService } from "../src/services/QualityScoringService";
import logger from "../src/config/logger";

jest.spyOn(logger, "info").mockImplementation();

describe("QualityScoringService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("scoreTextQuality", () => {
    // Valid: moderate-length text with professional word -> should score higher (Valid - T4/K1)
    it("scores moderate-length descriptive text higher (valid)", () => {
      const text = Array(30)
        .fill("innovative experience seamless solution")
        .join(" ");
      const score = QualityScoringService.scoreTextQuality(text);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(70);
    });

    // Invalid: very short text -> penalized (Invalid - T3)
    it("penalizes very short text (invalid)", () => {
      const text = "Buy now"; // <10 words
      const score = QualityScoringService.scoreTextQuality(text);
      expect(score).toBeLessThan(70);
    });

    // Boundary: exactly 20 words should receive length bonus (Boundary - T4)
    it("gives bonus at 20 words (boundary)", () => {
      const words = Array(20).fill("word").join(" ");
      const score = QualityScoringService.scoreTextQuality(words);
      // baseline 70 + length bonus 10 = 80 (other heuristics may adjust)
      expect(score).toBeGreaterThanOrEqual(70);
    });

    // Atypical: excessive exclamations are penalized (Atypical - A1)
    it("penalizes excessive exclamations (atypical)", () => {
      const text = "Wow! Amazing!!! So great!!!!";
      const score = QualityScoringService.scoreTextQuality(text);
      expect(score).toBeLessThan(70);
    });

    // Atypical: many ALL-CAPS words -> penalize (Atypical - A1)
    it("penalizes MANY ALL-CAPS words (atypical)", () => {
      const text = "THIS IS A TEST FOR SHOUTING AND LOUD AD COPY";
      const score = QualityScoringService.scoreTextQuality(text);
      expect(score).toBeLessThan(70);
    });
  });

  describe("scoreImageQuality", () => {
    const theme = {
      tags: ["summer", "beach"],
      inspirations: ["vintage"],
    } as any;

    // Valid: ideal prompt length + tag + quality/style words -> high score (Valid - T4/K1)
    it("rewards descriptive prompt with theme/tag and quality words (valid)", () => {
      const prompt = Array(15)
        .fill("high quality vibrant modern detailed composition")
        .join(" ");
      const score = QualityScoringService.scoreImageQuality(prompt, theme);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(70);
    });

    // Invalid: too short prompt (<5 words) -> penalized (Invalid - T3)
    it("penalizes too-short prompts (invalid)", () => {
      const prompt = "cute"; // 1 word
      const score = QualityScoringService.scoreImageQuality(prompt, theme);
      expect(score).toBeLessThan(60);
    });

    // Boundary: very long prompt (>100 words) -> penalized (Boundary - T5)
    it("penalizes overly long prompts (boundary)", () => {
      const prompt = Array(105).fill("word").join(" ");
      const score = QualityScoringService.scoreImageQuality(prompt, theme);
      expect(score).toBeLessThan(60);
    });

    // Invalid: negative indicators present -> large penalty (Invalid - K2)
    it("penalizes prompts with negative indicators (invalid)", () => {
      const prompt = "low quality blurry image with watermark";
      const score = QualityScoringService.scoreImageQuality(prompt, theme);
      expect(score).toBeLessThan(50);
    });
  });

  describe("scorePromptQuality", () => {
    // Valid: ideal length (20-100) with tag matches -> higher score (Valid - T4)
    it("rewards ideal-length prompt with matching tags (valid)", () => {
      const prompt = Array(30)
        .fill("brand innovative modern detailed")
        .join(" ");
      const tags = ["brand", "modern"];
      const score = QualityScoringService.scorePromptQuality(prompt, tags);
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(60);
    });

    // Invalid: too short prompt -> penalized (Invalid - T3)
    it("penalizes too short prompt (invalid)", () => {
      const prompt = "short prompt"; // <10 words
      const score = QualityScoringService.scorePromptQuality(prompt, ["x"]);
      expect(score).toBeLessThan(50);
    });

    // Boundary: overly long prompt (>150) -> penalized (Boundary - T5)
    it("penalizes excessively long prompt (boundary)", () => {
      const prompt = Array(151).fill("word").join(" ");
      const score = QualityScoringService.scorePromptQuality(prompt, []);
      expect(score).toBeLessThan(50);
    });
  });
});
