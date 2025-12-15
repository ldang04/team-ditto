/**
 * services/PromptEnhancementService.ts
 *
 * Enhances prompts with RAG context and predicts generation quality.
 */

import { RAGContext } from "./RAGService";
import logger from "../config/logger";
import { ThemeAnalysis } from "../types";
import { negativePromptKeywords } from "../config/keywords";

export class PromptEnhancementService {
  /**
   * Enhance a user's prompt by combining RAG context and theme analysis.
   *
   * @param userPrompt - Original prompt provided by the user.
   * @param ragContext - Retrieval-augmented context containing similar descriptions
   *                     and similarity metrics used to bias the enhancement.
   * @param themeAnalysis - Theme analysis results (colorPalette, visualMood,
   *                        dominantStyles, brandStrength, etc.) used to build
   *                        descriptive, design-forward prompt enhancements.
   * @returns A single enhanced prompt string that merges the original prompt
   *          with generated enhancements suitable for image/text generation.
   */
  static enhancePromtWithRAG(
    userPrompt: string,
    ragContext: RAGContext,
    themeAnalysis: ThemeAnalysis
  ): string {
    logger.info("PromptEnhancementService: Enhancing prompt with RAG");

    const enhancements: string[] = [];

    // Add RAG insights 
    if (ragContext.relevantContents && ragContext.relevantContents.length > 0) {
      // Extract useful text from past content (handle both text and image content)
      const topExamples = ragContext.relevantContents
        .slice(0, 2)
        .map((content) => {
          // For text content: use actual generated text
          // For image content: use the prompt (text_content contains base64 data)
          if (content.media_type === "text" && content.text_content) {
            return content.text_content;
          }
          // For images or fallback: use enhanced_prompt or prompt
          return content.enhanced_prompt || content.prompt || "";
        })
        .filter((text) => text.length > 20)
        .map((text) => text.slice(0, 200)); // Truncate to avoid prompt bloat

      if (topExamples.length > 0) {
        enhancements.push(
          `matching the style of previous successful content: "${topExamples.join('" and "')}"`
        );
      }
    } else if (ragContext.similarDescriptions.length > 0) {
      // Fallback to prompts if no content available
      const topPrompts = ragContext.similarDescriptions
        .slice(0, 2)
        .map((desc) => desc.slice(0, 150))
        .filter((desc) => desc.length > 10);

      if (topPrompts.length > 0) {
        enhancements.push(
          `drawing inspiration from previous brand prompts: "${topPrompts.join('" and "')}"`
        );
      }
    }

    // Add color palette: include primary, secondary and accent colors
    const {
      primary = [],
      secondary = [],
      accent = [],
    } = themeAnalysis.color_palette || {};
    const colorParts: string[] = [];
    if (primary.length > 0) colorParts.push(primary.join(" and "));
    if (secondary.length > 0) colorParts.push(secondary.join(" and "));
    if (accent.length > 0) colorParts.push(`${accent.join(" and ")} accents`);
    if (colorParts.length > 0) {
      enhancements.push(`featuring ${colorParts.join(", ")}`);
    }

    // Add mood
    enhancements.push(`with a ${themeAnalysis.visual_mood} atmosphere`);

    // Add dominant style(s) — guard for undefined and format naturally
    const styles = (themeAnalysis.dominant_styles || []).filter(Boolean);
    if (styles.length > 0) {
      let stylesPhrase = "";
      if (styles.length === 1) {
        stylesPhrase = styles[0];
      } else if (styles.length === 2) {
        stylesPhrase = `${styles[0]} and ${styles[1]}`;
      } else {
        stylesPhrase = `${styles.slice(0, -1).join(", ")} and ${
          styles[styles.length - 1]
        }`;
      }
      enhancements.push(`in ${stylesPhrase} style`);
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
   * Build a branded image prompt from theme and project context.
   *
   * Combines the user's prompt with project, stylePreferences,
   * targetAudience to form a high-quality prompt suitable for image generation.
   * Also constructs a negative prompt to avoid undesired artifacts.
   *
   * @param params - Object containing prompt details and theme context:
   *   - `userPrompt`, `projectName`, `projectDescription`, `stylePreferences`,
   *      and`targetAudience`.
   * @returns An object with `prompt` (string) and `negativePrompt` (string).
   */
  static buildBrandedPrompt(params: {
    userPrompt: string;
    projectName: string;
    projectDescription: string;
    themeInspirations: string[];
    stylePreferences?: Record<string, any>;
    targetAudience?: string;
  }): { prompt: string; negativePrompt: string } {
    const {
      userPrompt,
      projectName,
      projectDescription,
      themeInspirations,
      stylePreferences = {},
      targetAudience = "general",
    } = params;

    logger.info("PromptEnhancementService: Build branded prompt");

    // Build comprehensive branded prompt
    const promptParts = [
      // Main subject from user
      userPrompt,

      // Brand inspirations
      themeInspirations.length > 0
        ? `inspired by ${themeInspirations.slice(0, 2).join(" and ")}`
        : "",

      // Project context
      `for ${projectName}: ${projectDescription}`,

      // Target audience
      `designed for ${targetAudience} audience`,

      // Quality modifiers
      "high quality, professional, marketing-ready, detailed",

      // Style preferences if provided
      stylePreferences.composition
        ? `${stylePreferences.composition} composition`
        : "",
      stylePreferences.lighting ? `${stylePreferences.lighting} lighting` : "",
    ];

    const prompt = promptParts.filter((p) => p).join(", ");

    // Build negative prompt to avoid unwanted elements
    const negativePrompt = [
      ...negativePromptKeywords,
      stylePreferences.avoid || "",
    ]
      .filter((p) => p)
      .join(", ");

    logger.info(
      `PromptEnhancementService: Built branded prompt (${prompt.length} chars)`
    );

    return { prompt, negativePrompt };
  }

  /**
   * Estimate the expected generation quality (0-100) for a prompt enhanced by
   * RAG and theme analysis.
   *
   * @param themeAnalysis - Theme analysis (brandStrength, complexityScore, etc.)
   * @param ragContext - RAG context (avgSimilarity, similarDescriptions)
   * @param promptLength - Character length of the prompt (used to estimate word count)
   * @returns Rounded integer quality score clamped between 0 and 100.
   */
  static scoreRagQuality(
    themeAnalysis: ThemeAnalysis,
    ragContext: RAGContext,
    promptLength: number
  ): number {
    let score = 50;

    // Brand strength factor: small positive contribution to reflect alignment
    // between the theme's brand signals and the likely generation fidelity.
    score += (themeAnalysis.brand_strength || 0) * 0.2;

    // RAG similarity factor: stronger similarity to existing content implies
    // clearer, testable examples for the model — increase score accordingly.
    // Thresholds chosen to provide stepped boosts rather than a linear scale.
    const avgSim = ragContext?.avgSimilarity || 0;
    if (avgSim > 0.7) {
      score += 15;
    } else if (avgSim > 0.5) {
      score += 10;
    } else if (avgSim > 0.3) {
      score += 5;
    }

    // Prompt length factor: estimate word count from characters (approx. 5
    // chars per word). Very short prompts lack detail; a moderate-length
    // prompt is rewarded.
    const wordCount = Math.max(0, Math.round(promptLength / 5));
    if (wordCount >= 20 && wordCount <= 80) {
      score += 10;
    }

    // Complexity factor: higher complexity score suggests more detail and
    // structured inputs which can help generation — small boost.
    if ((themeAnalysis.complexity_score || 0) > 70) {
      score += 5;
    }

    // Clamp and round to an integer in [0, 100]
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
