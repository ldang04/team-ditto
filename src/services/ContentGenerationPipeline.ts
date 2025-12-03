/**
 * services/ContentGenerationPipeline.ts
 *
 * Orchestrates the content generation flow by coordinating multiple services:
 * - ThemeAnalysisService: Extracts color palette, styles, mood, brand strength
 * - RAGService: Retrieves similar past content for context
 * - PromptEnhancementService: Enhances prompts with RAG + theme analysis
 * - TextGenerationService: Generates content via Vertex AI
 * - QualityScoringService: Scores generated content quality
 *
 * This pipeline approach keeps the controller thin and makes the
 * generation logic testable and reusable.
 */

import { Project, Theme, ThemeAnalysis } from "../types";
import { ThemeAnalysisService } from "./ThemeAnalysisService";
import { RAGService, RAGContext } from "./RAGService";
import { PromptEnhancementService } from "./PromptEnhancementService";
import { TextGenerationService } from "./TextGenerationService";
import { QualityScoringService } from "./QualityScoringService";
import logger from "../config/logger";

/**
 * Input parameters for the generation pipeline.
 */
export interface GenerationInput {
  project: Project;
  theme: Theme;
  prompt: string;
  style_preferences?: Record<string, any>;
  target_audience?: string;
  variantCount?: number;
  media_type?: string;
}

/**
 * Quality metrics for a single generated variant.
 */
export interface VariantWithScore {
  content: string;
  qualityScore: number;
}

/**
 * Enriched result from the generation pipeline containing
 * generated content plus all computed metadata.
 */
export interface PipelineResult {
  variants: VariantWithScore[];
  metadata: {
    themeAnalysis: ThemeAnalysis;
    ragSimilarity: number;
    ragContentCount: number;
    enhancedPrompt: string;
    predictedQuality: number;
    averageQuality: number;
    generationTimestamp: string;
  };
}

export class ContentGenerationPipeline {
  /**
   * Execute the full content generation pipeline.
   *
   * Pipeline stages:
   * 1. [Parallel] Theme analysis + RAG retrieval
   * 2. Prompt enhancement using theme + RAG context
   * 3. Quality prediction (pre-generation estimate)
   * 4. Content generation via Vertex AI
   * 5. Quality scoring of each variant
   * 6. Aggregate and return enriched result
   *
   * @param input - Generation parameters including project, theme, and prompt
   * @returns PipelineResult with variants, scores, and metadata
   */
  static async execute(input: GenerationInput): Promise<PipelineResult> {
    const startTime = Date.now();
    logger.info(
      `ContentGenerationPipeline: Starting generation for project ${input.project.id}`
    );

    const {
      project,
      theme,
      prompt,
      style_preferences = {},
      target_audience = "general",
      variantCount = 3,
      media_type = "text",
    } = input;

    // ─────────────────────────────────────────────────────────────────────────
    // Stage 1: Parallel analysis (Theme + RAG are independent)
    // ─────────────────────────────────────────────────────────────────────────
    logger.info("ContentGenerationPipeline: Stage 1 - Parallel analysis");

    const [themeAnalysis, ragContext] = await Promise.all([
      this.analyzeTheme(theme),
      this.performRAG(project.id!, prompt, theme),
    ]);

    logger.info(
      `ContentGenerationPipeline: Theme analysis complete - mood: ${themeAnalysis.visual_mood}, brand strength: ${themeAnalysis.brand_strength}`
    );
    logger.info(
      `ContentGenerationPipeline: RAG complete - ${ragContext.relevantContents.length} similar items, avg similarity: ${ragContext.avgSimilarity.toFixed(3)}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Stage 2: Enhance prompt with RAG context and theme analysis
    // ─────────────────────────────────────────────────────────────────────────
    logger.info("ContentGenerationPipeline: Stage 2 - Prompt enhancement");

    const enhancedPrompt = PromptEnhancementService.enhancePromtWithRAG(
      prompt,
      ragContext,
      themeAnalysis
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Stage 3: Predict quality before generation
    // ─────────────────────────────────────────────────────────────────────────
    logger.info("ContentGenerationPipeline: Stage 3 - Quality prediction");

    const predictedQuality = PromptEnhancementService.scoreRagQuality(
      themeAnalysis,
      ragContext,
      enhancedPrompt.length
    );

    logger.info(
      `ContentGenerationPipeline: Predicted quality score: ${predictedQuality}`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Stage 4: Generate content via Vertex AI
    // ─────────────────────────────────────────────────────────────────────────
    logger.info("ContentGenerationPipeline: Stage 4 - Content generation");

    const rawVariants = await TextGenerationService.generateContent({
      project,
      theme,
      prompt: enhancedPrompt, // Use enhanced prompt
      style_preferences,
      target_audience,
      variantCount,
      media_type,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Stage 5: Score each generated variant
    // ─────────────────────────────────────────────────────────────────────────
    logger.info("ContentGenerationPipeline: Stage 5 - Quality scoring");

    const variantsWithScores: VariantWithScore[] = rawVariants.map(
      (content) => {
        const qualityScore =
          media_type === "image"
            ? QualityScoringService.scoreImageQuality(content, theme)
            : QualityScoringService.scoreTextQuality(content);

        return { content, qualityScore };
      }
    );

    // Calculate average quality across all variants
    const averageQuality =
      variantsWithScores.length > 0
        ? Math.round(
            variantsWithScores.reduce((sum, v) => sum + v.qualityScore, 0) /
              variantsWithScores.length
          )
        : 0;

    // ─────────────────────────────────────────────────────────────────────────
    // Stage 6: Assemble and return result
    // ─────────────────────────────────────────────────────────────────────────
    const elapsed = Date.now() - startTime;
    logger.info(
      `ContentGenerationPipeline: Complete in ${elapsed}ms - ${variantsWithScores.length} variants, avg quality: ${averageQuality}`
    );

    return {
      variants: variantsWithScores,
      metadata: {
        themeAnalysis,
        ragSimilarity: ragContext.avgSimilarity,
        ragContentCount: ragContext.relevantContents.length,
        enhancedPrompt,
        predictedQuality,
        averageQuality,
        generationTimestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Analyze theme with error handling fallback.
   */
  private static async analyzeTheme(theme: Theme): Promise<ThemeAnalysis> {
    try {
      return ThemeAnalysisService.analyzeTheme(theme);
    } catch (error) {
      logger.error("ContentGenerationPipeline: Theme analysis failed", error);
      // Return minimal fallback analysis
      return {
        color_palette: { primary: [], secondary: [], accent: [], mood: "neutral" },
        style_score: 50,
        dominant_styles: [],
        visual_mood: "balanced",
        complexity_score: 50,
        brand_strength: 50,
      };
    }
  }

  /**
   * Perform RAG retrieval with error handling fallback.
   */
  private static async performRAG(
    projectId: string,
    prompt: string,
    theme: Theme
  ): Promise<RAGContext> {
    try {
      return await RAGService.performRAG(projectId, prompt, theme);
    } catch (error) {
      logger.error("ContentGenerationPipeline: RAG retrieval failed", error);
      // Return empty context - generation can still proceed
      return {
        relevantContents: [],
        similarDescriptions: [],
        themeEmbedding: [],
        avgSimilarity: 0,
      };
    }
  }
}
