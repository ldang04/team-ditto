/**
 * services/QualityScoringService.ts
 * 
 * Calculates quality scores for text and image content.
 */

import logger from "../config/logger";

export class QualityScoringService {
  /**
   * Score text content quality
   */
  static scoreTextQuality(text: string): number {
    let score = 70;

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    // Length checks
    if (words.length >= 20 && words.length <= 200) {
      score += 10;
    } else if (words.length < 10 || words.length > 300) {
      score -= 10;
    }

    // Sentence structure
    if (sentences.length >= 2) {
      score += 5;
    }

    // Average word length
    const avgWordLength =
      words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (avgWordLength >= 5 && avgWordLength <= 8) {
      score += 5;
    }

    // Excessive punctuation
    if ((text.match(/[!]/g) || []).length > 3) {
      score -= 10;
    }

    // All caps check
    const capsWords = words.filter(
      (w) => w === w.toUpperCase() && w.length > 2
    );
    if (capsWords.length > words.length * 0.1) {
      score -= 10;
    }

    // Professional indicators
    const professionalWords = [
      "innovative",
      "professional",
      "seamless",
      "efficient",
      "experience",
      "solution",
    ];
    const professionalCount = professionalWords.filter((pw) =>
      text.toLowerCase().includes(pw)
    ).length;
    score += Math.min(professionalCount * 3, 10);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score image content quality (based on prompt)
   */
  static scoreImageQuality(promptText: string, theme: any): number {
    let score = 60;

    const lowerPrompt = promptText.toLowerCase();
    const words = promptText.split(/\s+/).filter((w) => w.length > 0);

    // Descriptive detail
    if (words.length >= 10 && words.length <= 50) {
      score += 15;
    } else if (words.length < 5) {
      score -= 15;
    } else if (words.length > 100) {
      score -= 10;
    }

    // Theme tag presence
    const themeTagMatches = theme.tags.filter((tag: string) =>
      lowerPrompt.includes(tag.toLowerCase())
    );
    score += Math.min(themeTagMatches.length * 5, 20);

    // Visual quality keywords
    const qualityKeywords = [
      "high quality",
      "detailed",
      "professional",
      "premium",
      "polished",
    ];
    const qualityMatches = qualityKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    score += Math.min(qualityMatches.length * 4, 12);

    // Style descriptors
    const styleKeywords = [
      "modern",
      "elegant",
      "minimalist",
      "bold",
      "vibrant",
    ];
    const styleMatches = styleKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    score += Math.min(styleMatches.length * 3, 10);

    // Color mentions
    const colorKeywords = [
      "red",
      "blue",
      "green",
      "yellow",
      "orange",
      "purple",
    ];
    const colorMatches = colorKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    if (colorMatches.length > 0) score += 8;

    // Composition keywords
    const compositionKeywords = [
      "composition",
      "layout",
      "centered",
      "symmetrical",
    ];
    const compositionMatches = compositionKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    if (compositionMatches.length > 0) score += 5;

    // Negative indicators
    if (lowerPrompt.includes("low quality") || lowerPrompt.includes("blurry")) {
      score -= 20;
    }

    // Brand inspiration alignment
    const inspirationMatches = theme.inspirations.filter((insp: string) =>
      lowerPrompt.includes(insp.toLowerCase())
    );
    score += Math.min(inspirationMatches.length * 6, 15);

    logger.info(`Image quality score: ${Math.max(0, Math.min(100, score))}`);

    return Math.max(0, Math.min(100, score));
  }
}

