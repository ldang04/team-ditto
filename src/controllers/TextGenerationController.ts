/**
 * controllers/TextGenerationController.ts
 *
 * Handles text content generation using Vertex AI Gemini.
 */

import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { EmbeddingService } from "../services/EmbeddingService";
import { ProjectThemeService } from "../services/ProjectThemeService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";
import { TextGenerationService } from "../services/TextGenerationService";

export const TextGenerationController = {
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

      const variants = await TextGenerationService.generateContent({
        project,
        theme,
        prompt,
        style_preferences,
        target_audience,
        variantCount: validatedVariantCount,
        media_type: "text",
      });

      const savedVariants =
        await TextGenerationController.saveGeneratedContents(
          variants,
          project_id,
          prompt,
          "text"
        );

      if (savedVariants.length === 0) {
        throw Error("Failed to save any content variants to database");
      }

      const serviceResponse = ServiceResponse.success(
        {
          variants: savedVariants,
          project_id,
          media_type: "text",
          variant_count: savedVariants.length,
          timestamp: new Date().toISOString(),
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

  async saveGeneratedContents(
    variants: string[],
    project_id: string,
    prompt: string,
    media_type: string
  ): Promise<any[]> {
    logger.info(`TextGenerationController: Save generated contents in db`);

    // Save each variant to database and generate embeddings
    const savedVariants = [];
    for (const variantContent of variants) {
      try {
        const { data, error } = await ContentModel.create({
          project_id,
          media_type,
          media_url: "text",
          text_content: variantContent,
          prompt,
        });

        if (data == null || data.id === null || error) {
          logger.error("Database save error:", error);
          continue;
        }

        await EmbeddingService.generateAndStoreText(data.id!, variantContent);

        savedVariants.push({
          content_id: data.id,
          generated_content: variantContent,
        });

        logger.info(`TextGenerationController: Saved text variant`);
      } catch (error) {
        logger.error(
          `TextGenerationController: Failed to save variant ${variantContent}:`,
          error
        );
        continue;
      }
    }

    return savedVariants;
  },
};
