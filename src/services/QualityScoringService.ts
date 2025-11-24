/**
 * services/QualityScoringService.ts
 *
 * Calculates quality scores for text and image content.
 */

import {
  colorKeywords,
  compositionKeywords,
  professionalWords,
  qualityKeywords,
  styleKeywords,
} from "../config/keywords";
import logger from "../config/logger";

export class QualityScoringService {
  /**
   * Score text content quality.
   *
   * Returns a heuristic quality score in the range [0, 100]. The score is
   * computed from several lightweight signals useful for marketing/UX copy:
   * - Length (prefers moderate-length copy)
   * - Sentence structure (multiple sentences preferred)
   * - Average word length (proxy for descriptive vocabulary)
   * - Punctuation and ALL-CAPS (penalize sensational/low-quality cues)
   * - Presence of professional vocabulary (small boost)
   *
   * @param text - The text content to evaluate.
   * @returns A numeric quality score between 0 and 100.
   */
  static scoreTextQuality(text: string): number {
    logger.info(`QualityScoringService: Calculate text score`);

    // Baseline score before heuristics
    let score = 70;

    // Tokenize into words and sentences for downstream heuristics
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // 1) Length checks: prefer moderate-length content (not too short/long)
    if (words.length >= 20 && words.length <= 200) {
      score += 10; // ideal length
    } else if (words.length < 10 || words.length > 300) {
      score -= 10; // too short or excessively long
    }

    // 2) Sentence structure: reward multiple sentences (better structure)
    if (sentences.length >= 2) {
      score += 5;
    }

    // 3) Average word length: proxy for descriptive vocabulary
    const avgWordLength =
      words.length > 0
        ? words.reduce((sum, w) => sum + w.length, 0) / words.length
        : 0;
    if (avgWordLength >= 5 && avgWordLength <= 8) {
      score += 5;
    }

    // 4) Excessive exclamation usage: penalize sensational tone
    if ((text.match(/[!]/g) || []).length > 3) {
      score -= 10;
    }

    // 5) Excessive ALL-CAPS words: treat as shouting / poor style
    const capsWords = words.filter(
      (w) => w === w.toUpperCase() && w.length > 2
    );
    if (words.length > 0 && capsWords.length > words.length * 0.1) {
      score -= 10;
    }

    // 6) Professional vocabulary: small capped boost for marketing tone
    const lower = text.toLowerCase();
    const professionalCount = professionalWords.filter((pw) =>
      lower.includes(pw)
    ).length;
    score += Math.min(professionalCount * 3, 10); // cap the boost

    // Final clamp to [0,100]
    const result = Math.max(0, Math.min(100, score));
    logger.info(`QualityScoringService: Calculated score: ${result}`);
    return result;
  }

  /**
   * Score image content quality (based on the generation prompt and theme).
   *
   * Produces a heuristic score in [0,100] using lightweight visual signals
   * inferred from the prompt text and theme metadata. The score is intended
   * as a coarse filter for generated image quality and alignment with the
   * brand/theme rather than a pixel-perfect perceptual metric.
   *
   * Heuristics included:
   * - Prompt descriptiveness (preferred length of instruction)
   * - Presence of theme tags (alignment with brand/theme)
   * - Visual quality keywords (e.g. "high quality", "detailed")
   * - Style descriptors (e.g. "modern", "vibrant")
   * - Color mentions and composition cues
   * - Negative indicators (explicit low-quality mentions)
   * - Brand inspiration alignment based on theme inspirations
   *
   * @param promptText - The textual prompt used to generate the image.
   * @param theme - Theme metadata (expects `tags` and `inspirations` arrays).
   * @returns A numeric quality score between 0 and 100.
   */
  static scoreImageQuality(promptText: string, theme: any): number {
    logger.info(`QualityScoringService: Calculate prompt text score for image`);

    // Start from a conservative baseline for image prompts
    let score = 60;

    const lowerPrompt = promptText.toLowerCase();
    const words = promptText.split(/\s+/).filter((w) => w.length > 0);

    // 1) Descriptive detail: prefer succinct but descriptive prompts
    if (words.length >= 10 && words.length <= 50) {
      score += 15; // sweet spot for most image prompts
    } else if (words.length < 5) {
      score -= 15; // likely too little detail
    } else if (words.length > 100) {
      score -= 10; // overly long prompts can be noisy
    }

    // 2) Theme tag presence: reward prompts that mention theme tags
    const themeTagMatches = (theme?.tags || []).filter((tag: string) =>
      lowerPrompt.includes(tag.toLowerCase())
    );
    score += Math.min(themeTagMatches.length * 5, 20);

    // 3) Visual quality keywords: explicit quality descriptors
    const qualityMatches = qualityKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    score += Math.min(qualityMatches.length * 4, 12);

    // 4) Style descriptors: reward presence of desirable style words
    const styleMatches = styleKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    score += Math.min(styleMatches.length * 3, 10);

    // 5) Color mentions: simple boost if colors are specified
    const colorMatches = colorKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    if (colorMatches.length > 0) score += 8;

    // 6) Composition cues: reward explicit composition/layout hints
    const compositionMatches = compositionKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    if (compositionMatches.length > 0) score += 5;

    // 7) Negative indicators: penalize if prompt explicitly asks for low-quality
    if (lowerPrompt.includes("low quality") || lowerPrompt.includes("blurry")) {
      score -= 20;
    }

    // 8) Brand inspiration alignment: reward references to theme inspirations
    const inspirationMatches = (theme?.inspirations || []).filter(
      (insp: string) => lowerPrompt.includes(insp.toLowerCase())
    );
    score += Math.min(inspirationMatches.length * 6, 15);

    // Log and clamp final score to [0,100]
    logger.info(`Image quality score: ${Math.max(0, Math.min(100, score))}`);

    const result = Math.max(0, Math.min(100, score));

    logger.info(
      `QualityScoringService: Calculated image prompt score: ${result}`
    );
    return result;
  }

  /**
   * Calculate a heuristic prompt quality score.
   *
   * @param prompt - The generated prompt text to evaluate.
   * @param themeTags - Theme tags that should be present in the prompt.
   * @returns A numeric score between 0 and 100 (higher is better).
   */
  static scorePromptQuality(prompt: string, themeTags: string[]): number {
    logger.info(`QualityScoringService: Calculate prompt quality`);

    // Start at a neutral baseline
    let score = 50;

    // Length check - reward prompts that are detailed but not excessively long
    const wordCount = prompt.split(/\s+/).length;
    if (wordCount >= 20 && wordCount <= 100) {
      score += 15; // ideal length
    } else if (wordCount < 10 || wordCount > 150) {
      score -= 10; // too short or too long
    }

    // Check for explicit theme tag inclusion to encourage brand alignment
    const lowerPrompt = prompt.toLowerCase();
    const tagMatches = themeTags.filter((tag) =>
      lowerPrompt.includes(tag.toLowerCase())
    );
    // Each match contributes, capped to avoid runaway scores
    score += Math.min(tagMatches.length * 5, 20);

    // Reward presence of quality-related keywords
    const qualityMatches = qualityKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    score += Math.min(qualityMatches.length * 3, 10);

    // Reward stylistic descriptors that indicate a clear style direction
    const styleMatches = styleKeywords.filter((desc) =>
      lowerPrompt.includes(desc)
    );
    score += Math.min(styleMatches.length * 3, 10);

    // Clamp score to [0, 100] and return
    const result = Math.max(0, Math.min(100, score));

    logger.info(`QualityScoringService: Calculated prompt score: ${result}`);
    return result;
  }
}
