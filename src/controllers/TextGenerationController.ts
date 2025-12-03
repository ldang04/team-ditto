/**
 * controllers/TextGenerationController.ts
 *
 * Handles text content generation using Vertex AI Gemini.
 * Orchestrates the ContentGenerationPipeline for enriched generation
 * with theme analysis, RAG context, and quality scoring.
 */

import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { EmbeddingService } from "../services/EmbeddingService";
import { ProjectThemeService } from "../services/ProjectThemeService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";
import {
  ContentGenerationPipeline,
  VariantWithScore,
} from "../services/ContentGenerationPipeline";

export const TextGenerationController = {
  async generate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${JSON.stringify(req.body)} `);

      // ───────────────────────────────────────────────────────────────────────
      // Input validation
      // ───────────────────────────────────────────────────────────────────────
      const {
        project_id,
        prompt,
        style_preferences = {},
        target_audience = "general",
        variantCount = 3,
      } = req.body;

      // Validate variantCount: must be an integer between 0 and 10.
      const requestedVariantCount = Number(variantCount);
      if (
        Number.isNaN(requestedVariantCount) ||
        !Number.isInteger(requestedVariantCount) ||
        requestedVariantCount < 0 ||
        requestedVariantCount > 10
      ) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Invalid variantCount: must be an integer between 0 and 10",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }
      const validatedVariantCount = requestedVariantCount;

      // Validation
      if (!project_id || !prompt) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Missing required fields: project_id and prompt",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // ───────────────────────────────────────────────────────────────────────
      // Fetch project and theme
      // ───────────────────────────────────────────────────────────────────────
      const projectThemeData = await ProjectThemeService.getProjectAndTheme(
        project_id
      );

      if (!projectThemeData) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Project or theme not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const { project, theme } = projectThemeData;

      // ───────────────────────────────────────────────────────────────────────
      // Execute generation pipeline (theme analysis, RAG, generation, scoring)
      // ───────────────────────────────────────────────────────────────────────
      const pipelineResult = await ContentGenerationPipeline.execute({
        project,
        theme,
        prompt,
        style_preferences,
        target_audience,
        variantCount: validatedVariantCount,
        media_type: "text",
      });

      // ───────────────────────────────────────────────────────────────────────
      // Persist variants to database with quality scores
      // ───────────────────────────────────────────────────────────────────────
      const savedVariants =
        await TextGenerationController.saveGeneratedContents(
          pipelineResult.variants,
          project_id,
          prompt,
          "text"
        );

      if (savedVariants.length === 0) {
        throw Error("Failed to save any content variants to database");
      }

      // ───────────────────────────────────────────────────────────────────────
      // Build enriched response with quality metrics and analysis
      // ───────────────────────────────────────────────────────────────────────
      const { metadata } = pipelineResult;

      const serviceResponse = ServiceResponse.success(
        {
          variants: savedVariants,
          project_id,
          media_type: "text",
          variant_count: savedVariants.length,
          timestamp: metadata.generationTimestamp,
          // Enriched quality metrics
          quality: {
            predicted: metadata.predictedQuality,
            average: metadata.averageQuality,
            per_variant: savedVariants.map((v) => v.quality_score),
          },
          // Theme analysis summary
          theme_analysis: {
            visual_mood: metadata.themeAnalysis.visual_mood,
            dominant_styles: metadata.themeAnalysis.dominant_styles,
            brand_strength: metadata.themeAnalysis.brand_strength,
            color_palette: metadata.themeAnalysis.color_palette,
          },
          // RAG context info
          rag_context: {
            similar_content_count: metadata.ragContentCount,
            avg_similarity: Math.round(metadata.ragSimilarity * 100) / 100,
          },
        },
        "Content generated successfully",
        StatusCodes.CREATED
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in TextGenerationController.generate:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Persist generated variants to database with embeddings.
   * Now also stores quality scores for each variant.
   */
  async saveGeneratedContents(
    variants: VariantWithScore[],
    project_id: string,
    prompt: string,
    media_type: string
  ): Promise<any[]> {
    logger.info(`TextGenerationController: Save generated contents in db`);

    // Save each variant to database and generate embeddings
    const savedVariants = [];
    for (const variant of variants) {
      try {
        const { data, error } = await ContentModel.create({
          project_id,
          media_type,
          media_url: "text",
          text_content: variant.content,
          prompt,
        });

        if (data == null || data.id === null || error) {
          logger.error("Database save error:", error);
          continue;
        }

        await EmbeddingService.generateAndStoreText(data.id!, variant.content);

        savedVariants.push({
          content_id: data.id,
          generated_content: variant.content,
          quality_score: variant.qualityScore,
        });

        logger.info(
          `TextGenerationController: Saved text variant (quality: ${variant.qualityScore})`
        );
      } catch (error) {
        logger.error(
          `TextGenerationController: Failed to save variant:`,
          error
        );
        continue;
      }
    }

    return savedVariants;
  },
};
