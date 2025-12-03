/**
 * controllers/ImageGenerationController.ts
 *
 * Handles image generation using Vertex AI Imagen with RAG and computational analysis.
 */

import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { EmbeddingService } from "../services/EmbeddingService";
import {
  GeneratedImage,
  ImageGenerationService,
} from "../services/ImageGenerationService";
import { RAGService } from "../services/RAGService";
import { ThemeAnalysisService } from "../services/ThemeAnalysisService";
import { PromptEnhancementService } from "../services/PromptEnhancementService";
import { StorageService } from "../services/StorageService";
import { ProjectThemeService } from "../services/ProjectThemeService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";
import { QualityScoringService } from "../services/QualityScoringService";

export const ImageGenerationController = {
  /**
   * HTTP handler to generate images for a project prompt.
   *
   * Behavior:
   * - Validates inputs (variant count and aspect ratio).
   * - Performs RAG retrieval to gather contextual examples.
   * - Analyzes the project's theme to extract colors/styles/mood.
   * - Enhances the prompt using RAG + theme signals, then composes a
   *   branded prompt and negativePrompt.
   * - Calls the image generation service, persists images to storage and DB,
   *   generates embeddings for saved content, and returns metrics.
   *
   * Responses:
   * - 201 Created with generation metadata on success
   * - 400 Bad Request for invalid inputs
   * - 404 Not Found when project/theme missing
   * - 500 Internal Server Error for unexpected failures
   */
  async generate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${JSON.stringify(req.body)} `);

      // Parse and validate request
      const {
        project_id,
        prompt,
        style_preferences = {},
        target_audience = "general",
        variantCount = 3,
        aspectRatio = "1:1",
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

      // Validate aspectRatio: ensure it is one of the supported ratios.
      const allowedAspectRatios = ["1:1", "16:9", "9:16", "4:5", "3:2"];
      const requestedAspectRatio = String(aspectRatio || "1:1");
      if (!allowedAspectRatios.includes(requestedAspectRatio)) {
        const serviceResponse = ServiceResponse.failure(
          null,
          `Invalid aspectRatio: must be one of ${allowedAspectRatios.join(
            ", "
          )}`,
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }
      const validatedAspectRatio = requestedAspectRatio;

      // Validation: either project_id or prompt must exist
      if (!project_id || !prompt) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Missing required fields: project_id and prompt",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Fetch project and theme
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

      logger.info(
        `ImageGenerationController: Starting generation for project ${project_id}`
      );

      // STEP 1: Perform RAG retrieval
      logger.info("STEP 1: RAG retrieval");
      const ragContext = await RAGService.performRAG(project_id, prompt, theme);

      // STEP 2: Analyze theme
      logger.info("STEP 2: Theme analysis");
      const themeAnalysis =
        theme.analysis ?? ThemeAnalysisService.analyzeTheme(theme);

      // STEP 3: Enhance prompt with RAG
      logger.info("STEP 3: Prompt enhancement");
      const enhancedPrompt = PromptEnhancementService.enhancePromtWithRAG(
        prompt,
        ragContext,
        themeAnalysis
      );

      // STEP 4: Build branded prompt
      // Compose the final prompt that includes branding context (project name,
      // description, audience) and also produce a negativePrompt to avoid
      // undesired artifacts during generation.
      logger.info("STEP 4: Building branded prompt");
      const { prompt: brandedPrompt, negativePrompt } =
        PromptEnhancementService.buildBrandedPrompt({
          userPrompt: enhancedPrompt,
          projectName: project.name,
          projectDescription: project.description,
          themeInspirations: theme.inspirations,
          stylePreferences: style_preferences,
          targetAudience: target_audience,
        });

      // STEP 5: Generate images
      logger.info("STEP 5: Generating images");
      const generatedImages = await ImageGenerationService.generateImages({
        prompt: brandedPrompt,
        negativePrompt: negativePrompt,
        aspectRatio: validatedAspectRatio as any,
        numberOfImages: validatedVariantCount,
        guidanceScale: 15,
      });

      // STEP 6: Save to storage and database
      logger.info("STEP 6: Saving to storage");
      const savedVariants = await ImageGenerationController.saveGeneratedImages(
        generatedImages,
        project_id,
        prompt,
        brandedPrompt
      );

      if (savedVariants.length === 0 && validatedVariantCount !== 0) {
        throw new Error("Failed to save any image variants");
      }

      // STEP 7: Calculate quality scores
      logger.info("STEP 7: Quality calculations");
      const promptQuality = QualityScoringService.scorePromptQuality(
        brandedPrompt,
        theme.tags
      );
      const predictedQuality = PromptEnhancementService.scoreRagQuality(
        themeAnalysis,
        ragContext,
        brandedPrompt.length
      );

      // Build response with metrics
      const serviceResponse = ServiceResponse.success(
        {
          variants: savedVariants,
          project_id,
          media_type: "image",
          variant_count: savedVariants.length,
          computation_metrics: {
            rag_similarity: ragContext.avgSimilarity,
            theme_analysis: themeAnalysis,
            prompt_quality: promptQuality,
            predicted_quality: predictedQuality,
            rag_context_items: ragContext.relevantContents.length,
          },
          timestamp: new Date().toISOString(),
        },
        "Images generated successfully with RAG and computational analysis",
        StatusCodes.CREATED
      );

      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("ImageGenerationController: Error in generate:", error);
      const serviceResponse = ServiceResponse.failure(
        error,
        "Image generation failed"
      );
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Persist generated images: create DB records, upload files, update rows,
   * and generate embeddings for each saved image.
   *
   * Steps per image:
   * 1. Create a placeholder content record in the DB (media_url empty).
   * 2. Upload image bytes to storage and obtain a public URL.
   * 3. Update the content record with the final `media_url`.
   * 4. Generate and store embeddings for the saved content.
   * 5. Accumulate metadata for the response (content id, URL, seed, prompts).
   *
   * The function returns an array of saved variant metadata; failures for
   * individual variants are logged and skipped so the caller can still receive
   * successfully persisted images.
   */
  async saveGeneratedImages(
    generatedImages: GeneratedImage[],
    project_id: string,
    prompt: string,
    enhancedPrompt: string
  ): Promise<any[]> {
    logger.info(
      `ImageGenerationController: Save generated images in db and storage`
    );
    const savedVariants: any[] = [];

    // Iterate through each generated image and persist it.
    for (let i = 0; i < generatedImages.length; i++) {
      const image = generatedImages[i];

      try {
        // 1) Create content record placeholder (media_url empty until upload completes).
        const { data: contentData, error: contentError } =
          await ContentModel.create({
            project_id,
            media_type: "image",
            media_url: "",
            text_content: image.imageData,
            enhanced_prompt: enhancedPrompt,
            prompt,
          });

        // If DB insert failed, skip this variant and log the error.
        if (contentError || !contentData) {
          logger.error(`Failed to create content record ${i}:`, contentError);
          continue;
        }

        // 2) Generate any required image embeddings and persist them.
        //    This is optional depending on EmbeddingService implementation.
        await EmbeddingService.generateAndStoreImage(
          contentData.id!,
          image.imageData
        ).catch((error) =>
          logger.error(`Failed to save embedding for record ${i}:`, error)
        );

        // 3) Upload image bytes to storage and get a final URL.
        const imageUrl = await StorageService.uploadImage(
          image.imageData,
          image.mimeType,
          project_id,
          contentData.id!
        );

        // 4) Update the DB record with the final media URL.
        await ContentModel.updateMediaUrl(contentData.id!, imageUrl);

        // 5) Add to the response payload collected for successful variants.
        savedVariants.push({
          content_id: contentData.id,
          image_url: imageUrl,
          prompt: prompt,
          enhancedPrompt,
          seed: image.seed,
        });

        logger.info(
          `ImageGenerationController: Saved image variant ${i + 1}/${
            generatedImages.length
          }`
        );
      } catch (error) {
        logger.error(
          `ImageGenerationController: Failed to save variant ${i}:`,
          error
        );
        continue;
      }
    }

    return savedVariants;
  },
};
