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
      logger.info(`${req.method} ${req.url} ${req.body}`);
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

      textContent = existingContent.text_content;
      actualMediaType = existingContent.media_type;
      projectId = existingContent.project_id;

      // Get or generate embedding
      const { data: embeddingData } = await EmbeddingsModel.getByContentId(
        content_id
      );
      if (embeddingData && embeddingData.length > 0) {
        contentEmbedding = embeddingData[0].embedding;
      } else if (media_type === "image") {
        contentEmbedding = await EmbeddingService.generateAndStoreImage(
          content_id,
          textContent
        );
        textContent = existingContent.prompt;
      } else {
        contentEmbedding = await EmbeddingService.generateAndStoreText(
          content_id,
          textContent
        );
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
    // stylistic signals. These short strings are what we embed and compare
    // against the content embedding.
    const brandTexts = [
      `${theme.name}: ${theme.tags?.join(", ") || ""}`,
      `Inspired by: ${theme.inspirations?.join(", ") || ""}`,
      `${project.description || ""}`,
      `Goals: ${project.goals || ""}`,
      `Target: ${project.customer_type || ""}`,
    ].filter(Boolean);

    if (brandTexts.length === 0) {
      // No brand signals available — return minimal alignment.
      return 0;
    }

    // Generate embeddings for each brand reference in parallel.
    const brandEmbeddings = await Promise.all(
      brandTexts.map((text) => EmbeddingService.generateDocumentEmbedding(text))
    );

    // Compute cosine similarity between the content and each brand embedding.
    const similarityScores = brandEmbeddings.map((brandEmb) =>
      EmbeddingService.cosineSimilarity(contentEmbedding, brandEmb)
    );

    // Average the similarity scores and convert to percentage.
    const avgSimilarity =
      similarityScores.reduce((sum, score) => sum + score, 0) /
      similarityScores.length;

    return Math.round(avgSimilarity * 100);
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
