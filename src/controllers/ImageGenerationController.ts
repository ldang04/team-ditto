/**
 * controllers/ImageGenerationController.ts
 *
 * Handles image generation using Vertex AI Imagen with RAG and computational analysis.
 */

import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { EmbeddingService } from "../services/EmbeddingService";
import { ImageGenerationService } from "../services/ImageGenerationService";
import { RAGService } from "../services/RAGService";
import { ThemeAnalysisService } from "../services/ThemeAnalysisService";
import { PromptEnhancementService } from "../services/PromptEnhancementService";
import { StorageService } from "../services/StorageService";
import { ProjectThemeService } from "../services/ProjectThemeService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const ImageGenerationController = {
  async generate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url}`, req.body);

      // Parse and validate request
      const {
        project_id,
        prompt,
        style_preferences = {},
        target_audience = "general",
        variantCount = 3,
        aspectRatio = "1:1",
      } = req.body;

      // Validation
      if (!project_id || !prompt) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Missing required fields: project_id and prompt",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Fetch project and theme
      const projectThemeData = await ProjectThemeService.getProjectAndTheme(project_id);

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
      const ragContext = await RAGService.performRAG(
        project_id,
        prompt,
        theme
      );

      // STEP 2: Analyze theme
      logger.info("STEP 2: Theme analysis");
      const themeAnalysis = ThemeAnalysisService.analyzeTheme(theme);

      // STEP 3: Enhance prompt with RAG
      logger.info("STEP 3: Prompt enhancement");
      const enhancedPrompt = PromptEnhancementService.enhanceWithRAG(
        prompt,
        ragContext,
        themeAnalysis
      );

      // STEP 4: Build branded prompt
      logger.info("STEP 4: Building branded prompt");
      const { prompt: brandedPrompt, negativePrompt } =
        ImageGenerationService.buildBrandedPrompt({
          userPrompt: enhancedPrompt,
          projectName: project.name,
          projectDescription: project.description,
          themeName: theme.name,
          themeTags: theme.tags,
          themeInspirations: theme.inspirations,
          stylePreferences: style_preferences,
          targetAudience: target_audience,
        });

      // STEP 5: Calculate quality scores
      logger.info("STEP 5: Quality calculations");
      const promptQuality = ImageGenerationService.calculatePromptQuality(
        brandedPrompt,
        theme.tags
      );
      const predictedQuality = PromptEnhancementService.predictQuality(
        themeAnalysis,
        ragContext,
        brandedPrompt.length
      );

      // STEP 6: Generate images
      logger.info("STEP 6: Generating images");
      const generatedImages = await ImageGenerationService.generateImages({
        prompt: brandedPrompt,
        negativePrompt: negativePrompt,
        aspectRatio: aspectRatio as any,
        numberOfImages: variantCount,
        guidanceScale: 15,
      });

      // STEP 7: Save to storage and database
      logger.info("STEP 7: Saving to storage");
      const savedVariants = await this.saveGeneratedImages(
        generatedImages,
        project_id,
        prompt,
        brandedPrompt,
        theme
      );

      if (savedVariants.length === 0) {
        throw new Error("Failed to save any image variants");
      }

      // Build response with metrics
      const serviceResponse = ServiceResponse.success(
        {
          success: true,
          variants: savedVariants,
          project_id,
          media_type: "image",
          variant_count: savedVariants.length,
          computation_metrics: {
            rag_similarity: ragContext.avgSimilarity,
            theme_analysis: {
              style_score: themeAnalysis.styleScore,
              dominant_styles: themeAnalysis.dominantStyles,
              visual_mood: themeAnalysis.visualMood,
              complexity_score: themeAnalysis.complexityScore,
              brand_strength: themeAnalysis.brandStrength,
              color_palette: themeAnalysis.colorPalette,
            },
            prompt_quality: promptQuality,
            predicted_quality: predictedQuality,
            rag_context_items: ragContext.relevantContent.length,
          },
          timestamp: new Date().toISOString(),
        },
        "Images generated successfully with RAG and computational analysis",
        StatusCodes.CREATED
      );

      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in ImageGenerationController.generate:", error);
      const serviceResponse = ServiceResponse.failure(
        error,
        "Image generation failed"
      );
      return handleServiceResponse(serviceResponse, res);
    }
  },

  async saveGeneratedImages(
    generatedImages: any[],
    project_id: string,
    prompt: string,
    brandedPrompt: string,
    theme: any
  ): Promise<any[]> {
    const savedVariants = [];

    for (let i = 0; i < generatedImages.length; i++) {
      const image = generatedImages[i];

      try {
        // Create content record
        const { data: contentData, error: contentError } =
          await ContentModel.create({
            project_id,
            media_type: "image",
            media_url: "",
            text_content: prompt,
          });

        if (contentError || !contentData) {
          logger.error(`Failed to create content record ${i}:`, contentError);
          continue;
        }

        // Upload to storage
        const imageUrl = await StorageService.uploadImage(
          image.imageData,
          image.mimeType,
          project_id,
          contentData.id!
        );

        // Update content with URL
        await ContentModel.create({
          ...contentData,
          media_url: imageUrl,
        });

        // Generate embeddings
        await EmbeddingService.generateAndStore(
          contentData.id!,
          `${prompt} - ${theme.name} style image`
        );

        savedVariants.push({
          content_id: contentData.id,
          image_url: imageUrl,
          prompt: prompt,
          branded_prompt: brandedPrompt,
          seed: image.seed,
        });

        logger.info(`Saved variant ${i + 1}/${generatedImages.length}`);
      } catch (error) {
        logger.error(`Failed to save variant ${i}:`, error);
        continue;
      }
    }

    return savedVariants;
  },
};

