/**
 * services/PromptEnhancementService.ts
 * 
 * Enhances prompts with RAG context and predicts generation quality.
 */

import { RAGContext } from "./RAGService";
import { ThemeAnalysis } from "./ThemeAnalysisService";
import logger from "../config/logger";

export class PromptEnhancementService {
  /**
   * Enhance prompt with RAG context
   */
  static enhanceWithRAG(
    userPrompt: string,
    ragContext: RAGContext,
    themeAnalysis: ThemeAnalysis
  ): string {
    logger.info("PromptEnhancementService: Enhancing prompt with RAG");

    const enhancements: string[] = [];

    // Add RAG insights
    if (ragContext.similarDescriptions.length > 0) {
      enhancements.push(
        "drawing inspiration from previous successful content styles"
      );
    }

    // Add color palette
    if (themeAnalysis.colorPalette.primary.length > 0) {
      enhancements.push(
        `featuring ${themeAnalysis.colorPalette.primary.join(" and ")} tones`
      );
    }

    // Add mood
    enhancements.push(`with a ${themeAnalysis.visualMood} atmosphere`);

    // Add dominant style
    if (themeAnalysis.dominantStyles.length > 0) {
      enhancements.push(
        `in ${themeAnalysis.dominantStyles[0]} ${themeAnalysis.dominantStyles[1] || "visual"} style`
      );
    }

    const enhancedPrompt = [userPrompt, ...enhancements]
      .filter((p) => p)
      .join(", ");

    logger.info(
      `Prompt enhanced: ${userPrompt.length} → ${enhancedPrompt.length} chars`
    );

    return enhancedPrompt;
  }

  /**
   * Predict generation quality
   */
  static predictQuality(
    themeAnalysis: ThemeAnalysis,
    ragContext: RAGContext,
    promptLength: number
  ): number {
    let score = 50;

    // Brand strength factor
    score += themeAnalysis.brandStrength * 0.2;

    // RAG similarity factor
    if (ragContext.avgSimilarity > 0.7) {
      score += 15;
    } else if (ragContext.avgSimilarity > 0.5) {
      score += 10;
    } else if (ragContext.avgSimilarity > 0.3) {
      score += 5;
    }

    // Prompt length factor
    const wordCount = promptLength / 5;
    if (wordCount >= 20 && wordCount <= 80) {
      score += 10;
    }

    // Complexity factor
    if (themeAnalysis.complexityScore > 70) {
      score += 5;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

