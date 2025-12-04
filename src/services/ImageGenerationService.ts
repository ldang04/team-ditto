/**
 * services/ImageGenerationService.ts
 *
 * Handles image generation using Vertex AI Gemini 2.5 Flash Image.
 * Uses @google/genai SDK with Vertex AI backend.
 */

import { GoogleGenAI, Modality } from "@google/genai";
import logger from "../config/logger";

export interface GeneratedImage {
  imageData: string; // Base64 encoded image
  mimeType: string;
  seed?: number;
}

export interface InputImage {
  data: string; // Base64 encoded image
  mimeType: string;
}

interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  numberOfImages?: number;
  seed?: number;
  guidanceScale?: number;
  inputImages?: InputImage[];
  overlayText?: string;
}

export class ImageGenerationService {
  private static client: GoogleGenAI;
  private static model: string = "gemini-2.5-flash-image"; // Gemini 2.5 Flash Image model for image generation

  /**
   * Initialize the service with GCP credentials via Vertex AI
   */
  static initialize() {
    this.client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GCP_PROJECT_ID || "",
      location: process.env.GCP_LOCATION || "us-central1",
    });
    logger.info(
      "ImageGenerationService: Initialized with Gemini 2.5 Flash Image via Vertex AI"
    );
  }

  /**
   * Generate images using Vertex AI Gemini.
   */
  static async generateImages(
    params: ImageGenerationParams
  ): Promise<GeneratedImage[]> {
    try {
      const numberOfImages = params.numberOfImages || 1;
      logger.info(
        `ImageGenerationService: Generating ${numberOfImages} images with Gemini`
      );

      // Build the prompt
      let fullPrompt = params.prompt;
      if (params.aspectRatio) {
        const aspectRatioHints: Record<string, string> = {
          "1:1": "square format",
          "16:9": "wide landscape format (16:9)",
          "9:16": "tall portrait format (9:16)",
          "4:3": "standard landscape format (4:3)",
          "3:4": "standard portrait format (3:4)",
        };
        fullPrompt += `. Generate in ${aspectRatioHints[params.aspectRatio] || "square format"}`;
      }

      if (params.negativePrompt) {
        fullPrompt += `. Avoid: ${params.negativePrompt}`;
      }

      if (params.overlayText) {
        fullPrompt += `\n\nIMPORTANT: Render the following text prominently and clearly in the image with professional typography: "${params.overlayText}"`;
      }

      logger.info(
        `ImageGenerationService: Request with prompt: ${fullPrompt.substring(0, 100)}...`
      );

      const generatedImages: GeneratedImage[] = [];

      for (let i = 0; i < numberOfImages; i++) {
        try {
          // Build contents array
          const contents: any[] = [];

          // Add input images if provided
          if (params.inputImages && params.inputImages.length > 0) {
            for (const inputImage of params.inputImages) {
              contents.push({
                inlineData: {
                  data: inputImage.data,
                  mimeType: inputImage.mimeType,
                },
              });
            }
            logger.info(
              `ImageGenerationService: Including ${params.inputImages.length} input image(s)`
            );
          }

          // Add text prompt
          contents.push(`Generate a high-quality marketing image: ${fullPrompt}`);

          const response = await this.client.models.generateContent({
            model: this.model,
            contents: contents,
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
            },
          });

          // Extract image from response
          if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                generatedImages.push({
                  imageData: part.inlineData.data || "",
                  mimeType: part.inlineData.mimeType || "image/png",
                });
                logger.info(
                  `ImageGenerationService: Generated image ${i + 1}/${numberOfImages}`
                );
                break;
              }
            }
          }
        } catch (imageError: any) {
          logger.error(
            `ImageGenerationService: Failed to generate image ${i + 1}: ${imageError?.message || imageError}`
          );
          logger.error(`Full error:`, JSON.stringify(imageError, null, 2));
        }
      }

      if (generatedImages.length === 0) {
        throw new Error("No images generated from Gemini API");
      }

      logger.info(
        `ImageGenerationService: Successfully generated ${generatedImages.length} images`
      );

      return generatedImages;
    } catch (error: any) {
      logger.error("ImageGenerationService: Failed to generate images:", error);
      throw new Error(
        `Image generation failed: ${error.message || "Unknown error"}`
      );
    }
  }
}

// Initialize on import
ImageGenerationService.initialize();
