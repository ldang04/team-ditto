/**
 * controllers/TextGenerationController.ts
 * 
 * Handles text content generation using Vertex AI Gemini.
 */

import { Request, Response } from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { ContentModel } from "../models/ContentModel";
import { EmbeddingService } from "../services/EmbeddingService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const TextGenerationController = {
  async generate(
    req: Request,
    res: Response,
    project: any,
    theme: any,
    prompt: string,
    style_preferences: any,
    target_audience: string,
    variantCount: number,
    media_type: string
  ) {
    try {
      const project_id = project.id;

      // Initialize Vertex AI
      const vertex = new VertexAI({
        project: process.env.GCP_PROJECT_ID,
        location: "us-central1",
      });

      const model = vertex.getGenerativeModel({
        model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
      });

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

      const result = await model.generateContent({
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

      let variants = [];
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

      // Save each variant to database and generate embeddings
      const savedVariants = [];
      for (const variantContent of variants) {
        const { data, error } = await ContentModel.create({
          project_id,
          media_type,
          media_url: "",
          text_content: variantContent,
        });

        if (error) {
          logger.error("Database save error:", error);
          continue;
        }

        await EmbeddingService.generateAndStore(data.id, variantContent);

        savedVariants.push({
          content_id: data.id,
          generated_content: variantContent,
        });
      }

      if (savedVariants.length === 0) {
        throw Error("Failed to save any content variants to database");
      }

      const serviceResponse = ServiceResponse.success(
        {
          success: true,
          variants: savedVariants,
          project_id,
          media_type,
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
};

