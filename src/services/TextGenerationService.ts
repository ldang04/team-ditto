/**
 * services/TextGenerationService.ts
 *
 * Handles text generation using Vertex AI API.
 */

import logger from "../config/logger";
import { GenerativeModel, VertexAI } from "@google-cloud/vertexai";
import { Project, Theme } from "../types";

interface TextGenerationParams {
  project: Project;
  theme: Theme;
  prompt: string;
  style_preferences: any;
  target_audience: string;
  variantCount: number;
  media_type: string;
}

export class TextGenerationService {
  private static vertex: VertexAI;
  private static model: GenerativeModel;
  private static location: string = "us-central1";

  /**
   * Initialize the service
   */
  static initialize() {
    this.vertex = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: this.location,
    });

    this.model = this.vertex.getGenerativeModel({
      model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
    });
    logger.info("TextGenerationService: Initialized");
  }

  /**
   * Generate text variants for a project using Vertex AI.
   *
   * Behavior & parsing:
   * - The generated prompt asks for variants separated with the explicit
   *   markers `---VARIANT_START---` and `---VARIANT_END---`.
   * - When markers are present in the model output, the function extracts
   *   the marked blocks. Otherwise it falls back to paragraph splitting.
   * - The returned array is truncated to `variantCount`.
   *
   * @param params - Text generation parameters including `project`, `theme`,
   *                 `prompt`, `variantCount`, `media_type`, and presentation hints.
   * @returns An array of generated variant strings (maximum length = variantCount).
   * @throws On Vertex AI or parsing failures; callers should handle errors
   *         and present friendly messages to clients.
   */
  static async generateContent(
    params: TextGenerationParams
  ): Promise<string[]> {
    try {
      logger.info(
        `TextGenerationService: Generating ${params.variantCount || 1} content`
      );

      const {
        project,
        theme,
        prompt,
        style_preferences = {},
        target_audience = "general",
        variantCount = 3,
        media_type = "text",
      } = params;

      // Build context-aware prompt with brand memory
      // CITATION: used AI to generate prompt for content generation
      const enhancedPrompt = `
        Generate ${variantCount} different variants of ${media_type} content for a marketing campaign with the following requirements:
        
        PROJECT CONTEXT:
        - Project Name: ${project.name}
        - Description: ${project.description}
        - Goals: ${project.goals}
        - Customer Type: ${project.customer_type}
        
        THEME & BRAND:
        - Theme Name: ${theme.name}
        - Font: ${theme.font}
        - Tags: ${theme.tags.join(", ")}
        - Inspirations: ${theme.inspirations.join(", ")}
        
        GENERATION REQUIREMENTS:
        - User Prompt: ${prompt}
        - Media Type: ${media_type}
        - Target Audience: ${target_audience}
        - Style Preferences: ${JSON.stringify(style_preferences)}
        
        Create ${variantCount} distinct, branded content variants that align with the project's theme and goals.
        Each variant should be clearly separated with "---VARIANT_START---" and "---VARIANT_END---" markers.
        Return the content in a format suitable for ${media_type} generation.
      `;

      const result = await this.model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: enhancedPrompt }],
          },
        ],
      });

      const generatedText =
        result.response.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No content generated";

      // Parse variants from the response
      const variantRegex = /---VARIANT_START---(.*?)---VARIANT_END---/gs;
      const matches = generatedText.match(variantRegex);

      let variants: string[] = [];
      if (matches && matches.length > 0) {
        variants = matches.map((match) =>
          match
            .replace(/---VARIANT_START---/g, "")
            .replace(/---VARIANT_END---/g, "")
            .trim()
        );
      } else {
        // Fallback: split by common separators
        const fallbackVariants = generatedText
          .split("\n\n")
          .filter((v) => v.trim().length > 0);
        variants =
          fallbackVariants.length > 0 ? fallbackVariants : [generatedText];
      }

      variants = variants.slice(0, variantCount);

      logger.info(
        `TextGenerationService: Successfully generated ${variants.length} contents`
      );

      return variants;
    } catch (error: any) {
      logger.error("TextGenerationService: Failed to generate text:", error);
      throw new Error(
        `TextGenerationService generation failed: ${
          error.message || "Unknown error"
        }`
      );
    }
  }
}

// Initialize on import
TextGenerationService.initialize();
