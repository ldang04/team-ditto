/**
 * services/ImageGenerationService.ts
 *
 * Handles image generation using Vertex AI Imagen API.
 * Supports Imagen 3 for high-quality branded image generation.
 */

import { GoogleAuth } from "google-auth-library";
import logger from "../config/logger";

interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4";
  numberOfImages?: number;
  seed?: number;
  guidanceScale?: number;
}

interface GeneratedImage {
  imageData: string; // Base64 encoded image
  mimeType: string;
  seed?: number;
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
   * Generate images using Vertex AI Imagen
   */
  static async generateImages(
    params: ImageGenerationParams
  ): Promise<GeneratedImage[]> {
    try {
      logger.info(
        `ImageGenerationService: Generating ${params.numberOfImages || 1} images`
      );

      const client = await this.auth.getClient();
      const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;

      // Build the request payload for Imagen
      const instances = [
        {
          prompt: params.prompt,
        },
      ];

      const requestParams: any = {
        sampleCount: params.numberOfImages || 1,
      };

      // Add optional parameters
      if (params.negativePrompt) {
        requestParams.negativePrompt = params.negativePrompt;
      }

      if (params.aspectRatio) {
        requestParams.aspectRatio = params.aspectRatio;
      }

      if (params.seed !== undefined) {
        requestParams.seed = params.seed;
      }

      if (params.guidanceScale !== undefined) {
        requestParams.guidanceScale = params.guidanceScale;
      }

      const requestBody = {
        instances,
        parameters: requestParams,
      };

      logger.info(
        `ImageGenerationService: Request to Imagen with prompt: ${params.prompt.substring(0, 100)}...`
      );

      const response = await client.request({
        url: endpoint,
        method: "POST",
        data: requestBody,
      });

      const predictions = (response.data as any)?.predictions || [];

      if (predictions.length === 0) {
        throw new Error("No images generated from Imagen API");
      }

      // Extract generated images
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

  /**
   * Build a branded image prompt from theme and project context
   * This includes computational analysis of theme elements
   */
  static buildBrandedPrompt(params: {
    userPrompt: string;
    projectName: string;
    projectDescription: string;
    themeName: string;
    themeTags: string[];
    themeInspirations: string[];
    stylePreferences?: Record<string, any>;
    targetAudience?: string;
  }): { prompt: string; negativePrompt: string } {
    const {
      userPrompt,
      projectName,
      projectDescription,
      themeName,
      themeTags,
      themeInspirations,
      stylePreferences = {},
      targetAudience = "general",
    } = params;

    // Computational step: Analyze theme tags and categorize them
    const styleKeywords = this.extractStyleKeywords(themeTags);
    const moodKeywords = this.extractMoodKeywords(themeTags);
    const colorKeywords = this.extractColorKeywords(themeTags);

    // Build comprehensive branded prompt
    const promptParts = [
      // Main subject from user
      userPrompt,

      // Brand theme integration
      `in a ${themeName} style`,

      // Style characteristics
      styleKeywords.length > 0
        ? `with ${styleKeywords.join(", ")} aesthetic`
        : "",

      // Mood and atmosphere
      moodKeywords.length > 0
        ? `conveying a ${moodKeywords.join(", ")} mood`
        : "",

      // Color palette
      colorKeywords.length > 0
        ? `using ${colorKeywords.join(", ")} color palette`
        : "",

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
      "low quality",
      "blurry",
      "distorted",
      "watermark",
      "text overlay",
      "unprofessional",
      "amateur",
      "pixelated",
      "artifacts",
      stylePreferences.avoid || "",
    ]
      .filter((p) => p)
      .join(", ");

    logger.info(
      `ImageGenerationService: Built branded prompt (${prompt.length} chars)`
    );

    return { prompt, negativePrompt };
  }

  /**
   * COMPUTATIONAL: Extract style-related keywords from theme tags
   */
  private static extractStyleKeywords(tags: string[]): string[] {
    const stylePatterns = [
      "modern",
      "minimalist",
      "vintage",
      "retro",
      "futuristic",
      "classic",
      "elegant",
      "bold",
      "clean",
      "rustic",
      "industrial",
      "organic",
      "geometric",
      "abstract",
      "realistic",
      "artistic",
      "corporate",
      "playful",
    ];

    return tags.filter((tag) =>
      stylePatterns.some((pattern) =>
        tag.toLowerCase().includes(pattern.toLowerCase())
      )
    );
  }

  /**
   * COMPUTATIONAL: Extract mood-related keywords from theme tags
   */
  private static extractMoodKeywords(tags: string[]): string[] {
    const moodPatterns = [
      "professional",
      "friendly",
      "energetic",
      "calm",
      "exciting",
      "sophisticated",
      "warm",
      "cool",
      "dynamic",
      "serene",
      "vibrant",
      "subdued",
      "luxurious",
      "approachable",
      "innovative",
      "trustworthy",
    ];

    return tags.filter((tag) =>
      moodPatterns.some((pattern) =>
        tag.toLowerCase().includes(pattern.toLowerCase())
      )
    );
  }

  /**
   * COMPUTATIONAL: Extract color-related keywords from theme tags
   */
  private static extractColorKeywords(tags: string[]): string[] {
    const colorPatterns = [
      "red",
      "blue",
      "green",
      "yellow",
      "orange",
      "purple",
      "pink",
      "black",
      "white",
      "gray",
      "grey",
      "brown",
      "gold",
      "silver",
      "pastel",
      "bright",
      "dark",
      "light",
      "muted",
      "saturated",
      "monochrome",
      "colorful",
    ];

    return tags.filter((tag) =>
      colorPatterns.some((pattern) =>
        tag.toLowerCase().includes(pattern.toLowerCase())
      )
    );
  }

  /**
   * COMPUTATIONAL: Calculate prompt quality score
   * Higher score = better alignment with brand guidelines
   */
  static calculatePromptQuality(prompt: string, themeTags: string[]): number {
    let score = 50; // Baseline

    // Length check - prompts should be detailed but not excessive
    const wordCount = prompt.split(/\s+/).length;
    if (wordCount >= 20 && wordCount <= 100) {
      score += 15;
    } else if (wordCount < 10 || wordCount > 150) {
      score -= 10;
    }

    // Check for theme tag integration
    const lowerPrompt = prompt.toLowerCase();
    const tagMatches = themeTags.filter((tag) =>
      lowerPrompt.includes(tag.toLowerCase())
    );
    score += Math.min(tagMatches.length * 5, 20);

    // Check for quality modifiers
    const qualityKeywords = [
      "professional",
      "high quality",
      "detailed",
      "premium",
      "polished",
    ];
    const qualityMatches = qualityKeywords.filter((keyword) =>
      lowerPrompt.includes(keyword)
    );
    score += Math.min(qualityMatches.length * 3, 10);

    // Check for style descriptors
    const styleDescriptors = [
      "modern",
      "elegant",
      "minimalist",
      "bold",
      "vibrant",
    ];
    const styleMatches = styleDescriptors.filter((desc) =>
      lowerPrompt.includes(desc)
    );
    score += Math.min(styleMatches.length * 3, 10);

    return Math.max(0, Math.min(100, score));
  }
}

// Initialize on import
ImageGenerationService.initialize();

