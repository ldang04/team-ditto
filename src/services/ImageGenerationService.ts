/**
 * services/ImageGenerationService.ts
 *
 * Handles image generation using Vertex AI Imagen API.
 * Supports Imagen 3 for high-quality branded image generation.
 */

import { GoogleAuth } from "google-auth-library";
import logger from "../config/logger";

export interface GeneratedImage {
  imageData: string; // Base64 encoded image
  mimeType: string;
  seed?: number;
}

interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  numberOfImages?: number;
  seed?: number;
  guidanceScale?: number;
}

export class ImageGenerationService {
  private static auth: GoogleAuth;
  private static projectId: string;
  private static location: string = "us-central1";
  private static model: string = "imagen-3.0-generate-001"; // Latest Imagen model

  /**
   * Initialize the service with GCP credentials
   */
  static initialize() {
    this.auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
    this.projectId = process.env.GCP_PROJECT_ID || "";
    logger.info("ImageGenerationService: Initialized");
  }

  /**
   * Generate images using Vertex AI Imagen.
   *
   * Sends a request to the configured Imagen model endpoint with the
   * provided `params` (prompt, optional negative prompt, sampling and
   * guidance settings) and returns an array of generated images encoded in
   * base64 along with MIME types and optional seed values.
   *
   * @param params - Image generation parameters including `prompt`,
   * `negativePrompt`, `numberOfImages`, `seed`, and other optional options.
   * @returns A Promise resolving to an array of `GeneratedImage` objects
   * containing `imageData` (base64), `mimeType`, and optional `seed`.
   * @throws If the Imagen API returns no predictions or if the request fails.
   */
  static async generateImages(
    params: ImageGenerationParams
  ): Promise<GeneratedImage[]> {
    try {
      logger.info(
        `ImageGenerationService: Generating ${
          params.numberOfImages || 1
        } images`
      );

      const client = await this.auth.getClient();

      // Build the Imagen model predict endpoint URL
      const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;

      // Build the request payload for Imagen
      const instances = [
        {
          prompt: params.prompt,
        },
      ];

      // Parameters controlling sampling and model behavior
      const requestParams: any = { sampleCount: params.numberOfImages || 1 };

      // Attach optional parameters provided by the caller
      if (params.negativePrompt)
        requestParams.negativePrompt = params.negativePrompt;
      if (params.aspectRatio) requestParams.aspectRatio = params.aspectRatio;
      if (params.seed !== undefined) requestParams.seed = params.seed;
      if (params.guidanceScale !== undefined)
        requestParams.guidanceScale = params.guidanceScale;

      const requestBody = {
        instances,
        parameters: requestParams,
      };

      logger.info(
        `ImageGenerationService: Request to Imagen with prompt: ${params.prompt.substring(
          0,
          100
        )}...`
      );

      const response = await client.request({
        url: endpoint,
        method: "POST",
        data: requestBody,
      });

      // Parse predictions from the API response
      const predictions = (response.data as any)?.predictions || [];

      // If API returned no items, raise an error so caller can handle it
      if (predictions.length === 0) {
        throw new Error("No images generated from Imagen API");
      }

      // Map the API predictions into our internal GeneratedImage shape
      const generatedImages: GeneratedImage[] = predictions.map(
        (prediction: any) => ({
          imageData: prediction.bytesBase64Encoded,
          mimeType: prediction.mimeType || "image/png",
          seed: prediction.seed,
        })
      );

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
