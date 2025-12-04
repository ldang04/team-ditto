/**
 * controllers/ValidationController.ts
 *
 * Handles content validation against brand guidelines.
 */

import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import { EmbeddingService } from "../services/EmbeddingService";
import { QualityScoringService } from "../services/QualityScoringService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";
import { ProjectThemeService } from "../services/ProjectThemeService";
import { Project, Theme } from "../types";

export const ValidationController = {
  /**
   * HTTP handler to validate content against project brand guidelines.
   *
   * Behavior:
   * - Validates input shape and loads/normalizes content data (embeddings).
   * - Retrieves the project's theme and computes brand-consistency using
   *   embedding similarity to short brand reference texts.
   * - Computes a quality score (text or image heuristics) and combines it
   *   with brand consistency to produce an overall score and human-friendly
   *   insights for the caller/UI.
   *
   * Responses:
   * - 200 OK with a `validation` object on success
   * - 400 Bad Request for malformed input
   * - 404 Not Found when project or theme cannot be located
   * - 500 Internal Server Error for unexpected failures
   */
  async validate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${JSON.stringify(req.body)} `);
      const { content_id, content, project_id, media_type } = req.body;

      let serviceResponse;

      // Require either a content_id OR both content + project_id for ad-hoc text.
      if (!content_id && (!content || !project_id)) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Must provide either content_id OR (content + project_id)",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      //Get content data and embedding
      const { projectId, textContent, contentEmbedding, actualMediaType } =
        await ValidationController.getContentData(
          content_id,
          content,
          project_id,
          media_type
        );

      //Get project and theme, if not exist, throw an error
      const projectThemeData = await ProjectThemeService.getProjectAndTheme(
        projectId
      );

      if (!projectThemeData) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Project or theme not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Compare the content embedding against concise brand reference
      const brandConsistencyScore =
        await ValidationController.calculateBrandConsistency(
          contentEmbedding,
          projectThemeData.project,
          projectThemeData.theme
        );

      const qualityScore =
        actualMediaType === "image"
          ? QualityScoringService.scoreImageQuality(
              textContent,
              projectThemeData.theme
            )
          : QualityScoringService.scoreTextQuality(textContent);

      // Weighted combination: 60% brand alignment, 40% quality.
      const overallScore = Math.round(
        brandConsistencyScore * 0.6 + qualityScore * 0.4
      );
      const passesValidation = overallScore >= 70;

      // Generate human-friendly insights
      const validation = ValidationController.generateValidationInsights(
        brandConsistencyScore,
        qualityScore,
        overallScore,
        passesValidation,
        textContent,
        projectThemeData.theme,
        projectThemeData.project
      );

      serviceResponse = ServiceResponse.success(
        {
          content_id: content_id || null,
          project_id: projectId,
          validation,
          timestamp: new Date().toISOString(),
        },
        "Success",
        StatusCodes.OK
      );
      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in ValidationController.validate:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Retrieve and normalize content data for validation.
   *
   * @param content_id - optional content DB id to load
   * @param content - optional raw content string (used when no content_id)
   * @param project_id - optional project id (used when no content_id)
   * @param media_type - optional media type hint ("text" | "image")
   * @returns An object containing { projectId, textContent, contentEmbedding, actualMediaType }
   */
  async getContentData(
    content_id: string | undefined,
    content: string | undefined,
    project_id: string | undefined,
    media_type: string | undefined
  ) {
    logger.info(`ValidationController: get content data`);

    let projectId: string;
    let textContent: string;
    let contentEmbedding: number[];
    let actualMediaType: string = media_type || "text";

    if (content_id) {
      // Validate existing content
      const { data: existingContent, error } = await ContentModel.getById(
        content_id
      );
      if (error || !existingContent) {
        throw new Error("Content not found");
      }

      actualMediaType = existingContent.media_type;
      projectId = existingContent.project_id;

      // For images, use the enhanced_prompt for brand comparison (contains brand keywords)
      // Fall back to original prompt if enhanced_prompt not available
      // For text, use the text_content directly
      if (actualMediaType === "image") {
        textContent = existingContent.enhanced_prompt || existingContent.prompt || "";
      } else {
        textContent = existingContent.text_content;
      }

      // Get or generate embedding for brand consistency comparison
      // For images: use text embedding of the ENHANCED_PROMPT for brand comparison
      //   - Enhanced prompt contains brand keywords (Mofusand, Smiski, playful, etc)
      //   - This compares what the image was generated from vs brand guidelines
      // For text: use the text embedding directly
      if (actualMediaType === "image") {
        // Generate text embedding from the prompt for brand comparison
        contentEmbedding = await EmbeddingService.generateDocumentEmbedding(
          textContent
        );
      } else {
        // For text content, try to get existing embedding or generate new one
        const { data: embeddingData } = await EmbeddingsModel.getByContentId(
          content_id
        );
        if (embeddingData && embeddingData.length > 0) {
          contentEmbedding = embeddingData[0].embedding;
        } else {
          contentEmbedding = await EmbeddingService.generateAndStoreText(
            content_id,
            textContent
          );
        }
      }
    } else {
      // Validate new content
      textContent = content!;
      projectId = project_id!;
      contentEmbedding = await EmbeddingService.generateDocumentEmbedding(
        textContent
      );
    }

    return { projectId, textContent, contentEmbedding, actualMediaType };
  },

  /**
   * Compute how closely the provided content embedding aligns with the
   * project's brand signals derived from theme and project metadata.
   *
   * @param contentEmbedding - Embedding vector for the content being validated
   * @param project - Project object (expects `description`, `goals`, `customer_type`)
   * @param theme - Theme object (expects `name`, `tags`, `inspirations`)
   * @returns A rounded integer percentage [0-100] representing average similarity
   */
  async calculateBrandConsistency(
    contentEmbedding: number[],
    project: Project,
    theme: Theme
  ): Promise<number> {
    // Build concise reference texts that capture the brand's language and
    // stylistic signals. Only include texts that have meaningful content.
    const brandTexts: string[] = [];

    // Theme-based signals (these are the strongest brand indicators)
    if (theme.name && theme.tags?.length) {
      brandTexts.push(`${theme.name}: ${theme.tags.join(", ")}`);
    }
    if (theme.inspirations?.length) {
      brandTexts.push(`Inspired by: ${theme.inspirations.join(", ")}`);
    }

    // Project-based signals (only add if they have actual content)
    if (project.description?.trim()) {
      brandTexts.push(project.description);
    }
    if (project.goals?.trim()) {
      brandTexts.push(`Goals: ${project.goals}`);
    }
    if (project.customer_type?.trim()) {
      brandTexts.push(`Target audience: ${project.customer_type}`);
    }

    if (brandTexts.length === 0) {
      // No brand signals available — return minimal alignment.
      return 0;
    }

    // Generate embeddings for each brand reference in parallel.
    // Use RETRIEVAL_DOCUMENT task type for symmetric comparison with content embeddings.
    const brandEmbeddings = await Promise.all(
      brandTexts.map((text) => EmbeddingService.generateDocumentEmbedding(text))
    );

    // Compute cosine similarity between the content and each brand embedding.
    const similarityScores = brandEmbeddings.map((brandEmb) =>
      EmbeddingService.cosineSimilarity(contentEmbedding, brandEmb)
    );

    // Average the similarity scores and scale to intuitive percentage.
    // text-embedding-004 produces similarity in range ~0.3-0.8 for varied content:
    // - 0.3-0.4: unrelated content
    // - 0.5-0.6: weakly related
    // - 0.6-0.7: moderately related
    // - 0.7-0.8: strongly related
    // We scale this to 0-100% where:
    // - <0.4 maps to 0-40% (poor alignment)
    // - 0.4-0.6 maps to 40-70% (moderate alignment)
    // - >0.6 maps to 70-100% (good alignment)
    const avgSimilarity =
      similarityScores.reduce((sum, score) => sum + score, 0) /
      similarityScores.length;

    // Scale similarity to more intuitive brand score
    // Baseline of 0.4 represents random/unrelated content
    // Similarity of 0.75+ represents excellent brand match
    const baseline = 0.4;
    const ceiling = 0.75;
    const scaledScore = Math.max(
      0,
      Math.min(100, ((avgSimilarity - baseline) / (ceiling - baseline)) * 100)
    );

    return Math.round(scaledScore);
  },

  /**
   * Produce a human-readable set of validation insights from computed scores.
   *
   * Rules and outputs:
   * - brandConsistencyScore and qualityScore are evaluated against thresholds
   *   (>=80 strong, <60 problematic) to decide strengths vs. major issues.
   * - Minor issues are detected from lightweight patterns (e.g., repeated
   *   exclamation marks, very short content).
   * - Recommendations include references to theme inspirations and a prompt
   *   to address audience when the content does not appear to mention it.
   * - A short textual `summary` is produced from the `overallScore`.
   *
   * @returns An object with fields: brand_consistency_score, quality_score,
   *          overall_score, passes_validation, strengths, issues,
   *          recommendations, and summary.
   */
  generateValidationInsights(
    brandConsistencyScore: number,
    qualityScore: number,
    overallScore: number,
    passesValidation: boolean,
    textContent: string,
    theme: Theme,
    project: Project
  ) {
    // Collect lists that will be shown to users as part of validation output.
    const strengths: string[] = [];
    const issues: Array<Record<string, any>> = [];
    const recommendations: string[] = [];

    // --- Brand alignment analysis ---
    // Strong brand alignment when consistency >= 80. Major alignment issues
    // when consistency drops below 60.
    if (brandConsistencyScore >= 80) {
      strengths.push("Strong alignment with brand guidelines");
    } else if (brandConsistencyScore < 60) {
      issues.push({
        severity: "major",
        category: "brand_alignment",
        description: "Content does not strongly align with brand theme",
        suggestion: `Incorporate: ${theme.tags.slice(0, 3).join(", ")}`,
      });
    }

    // --- Content quality analysis ---
    // Treat quality >= 80 as a strength, <60 as a major clarity problem.
    if (qualityScore >= 80) {
      strengths.push("High-quality content with good structure");
    } else if (qualityScore < 60) {
      issues.push({
        severity: "major",
        category: "clarity",
        description: "Content quality could be improved",
        suggestion: "Review for clarity and professional tone",
      });
    }

    // --- Pattern-based minor checks ---
    // Detect excessive punctuation which often indicates tone issues.
    if (textContent.match(/[!]{2,}/)) {
      issues.push({
        severity: "minor",
        category: "tone",
        description: "Excessive exclamation marks detected",
        suggestion: "Use a more professional tone",
      });
    }

    // Short content can be a clarity issue — flag as minor.
    if (textContent.length < 50) {
      issues.push({
        severity: "minor",
        category: "clarity",
        description: "Content is very short",
        suggestion: "Consider adding more detail",
      });
    }

    // --- Recommendations construction ---
    // Provide a reference suggestion when brand alignment is weak.
    if (brandConsistencyScore < 80) {
      recommendations.push(
        `Reference: ${theme.inspirations.slice(0, 2).join(", ")}`
      );
    }

    // Suggest addressing the primary audience if it isn't mentioned in text.
    const primaryAudienceToken = (project.customer_type || "").split(" ")[0];
    if (
      primaryAudienceToken &&
      !textContent.toLowerCase().includes(primaryAudienceToken.toLowerCase())
    ) {
      recommendations.push(`Address audience: ${project.customer_type}`);
    }

    // --- Summary text ---
    let summary = "";
    if (overallScore >= 85) {
      summary = "Excellent content that aligns well with brand guidelines.";
    } else if (overallScore >= 70) {
      summary = "Good content with minor improvements possible.";
    } else if (overallScore >= 50) {
      summary = "Content needs revision to better align with brand.";
    } else {
      summary = "Content significantly deviates from brand guidelines.";
    }

    // Final structured response for the caller/UI.
    return {
      brand_consistency_score: brandConsistencyScore,
      quality_score: qualityScore,
      overall_score: overallScore,
      passes_validation: passesValidation,
      strengths:
        strengths.length > 0 ? strengths : ["Meets basic requirements"],
      issues,
      recommendations:
        recommendations.length > 0
          ? recommendations
          : ["Content is well-aligned"],
      summary,
    };
  },
};
