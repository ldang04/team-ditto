/**
 * controllers/ValidationController.ts
 * 
 * Handles content validation against brand guidelines.
 */

import { Request, Response } from "express";
import { ContentModel } from "../models/ContentModel";
import { ProjectModel } from "../models/ProjectModel";
import { ThemeModel } from "../models/ThemeModel";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import { EmbeddingService } from "../services/EmbeddingService";
import { QualityScoringService } from "../services/QualityScoringService";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export const ValidationController = {
  /**
   * Validate content against brand guidelines
   * Supports both text and image content
   */
  async validate(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${req.body}`);
      const { content_id, content, project_id, media_type } = req.body;

      let serviceResponse;

      // Validate input
      if (!content_id && (!content || !project_id)) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Must provide either content_id OR (content + project_id)",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Get content and embeddings
      const { projectId, textContent, contentEmbedding, actualMediaType } =
        await ValidationController.getContentData(content_id, content, project_id, media_type);

      // Fetch project and theme
      const { data: project, error: projectError } =
        await ProjectModel.getById(projectId);
      if (projectError || !project) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Project not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      const { data: theme, error: themeError } = await ThemeModel.getById(
        project.theme_id
      );
      if (themeError || !theme) {
        serviceResponse = ServiceResponse.failure(
          null,
          "Theme not found",
          StatusCodes.NOT_FOUND
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Calculate brand consistency
      const brandConsistencyScore = await ValidationController.calculateBrandConsistency(
        contentEmbedding,
        project,
        theme
      );

      // Calculate quality score
      const qualityScore =
        actualMediaType === "image"
          ? QualityScoringService.scoreImageQuality(textContent, theme)
          : QualityScoringService.scoreTextQuality(textContent);

      // Calculate overall score
      const overallScore = Math.round(
        brandConsistencyScore * 0.6 + qualityScore * 0.4
      );
      const passesValidation = overallScore >= 70;

      // Generate insights
      const validation = ValidationController.generateValidationInsights(
        brandConsistencyScore,
        qualityScore,
        overallScore,
        passesValidation,
        textContent,
        theme,
        project
      );

      serviceResponse = ServiceResponse.success(
        {
          success: true,
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

  async getContentData(
    content_id: string | undefined,
    content: string | undefined,
    project_id: string | undefined,
    media_type: string | undefined
  ) {
    let projectId: string;
    let textContent: string;
    let contentEmbedding: number[];
    let actualMediaType: string = media_type || "text";

    if (content_id) {
      // Validate existing content
      const { data: existingContent, error } =
        await ContentModel.getById(content_id);
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
      } else {
        contentEmbedding = await EmbeddingService.generateAndStore(
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

  async calculateBrandConsistency(
    contentEmbedding: number[],
    project: any,
    theme: any
  ): Promise<number> {
    // Build brand reference texts
    const brandTexts = [
      `${theme.name}: ${theme.tags.join(", ")}`,
      `Inspired by: ${theme.inspirations.join(", ")}`,
      `${project.description}`,
      `Goals: ${project.goals}`,
      `Target: ${project.customer_type}`,
    ];

    // Generate embeddings for brand references
    const brandEmbeddings = await Promise.all(
      brandTexts.map((text) => EmbeddingService.generateDocumentEmbedding(text))
    );

    // Calculate similarity scores
    const similarityScores = brandEmbeddings.map((brandEmb) =>
      EmbeddingService.cosineSimilarity(contentEmbedding, brandEmb)
    );

    // Average similarity
    const avgSimilarity =
      similarityScores.reduce((sum, score) => sum + score, 0) /
      similarityScores.length;

    return Math.round(avgSimilarity * 100);
  },

  generateValidationInsights(
    brandConsistencyScore: number,
    qualityScore: number,
    overallScore: number,
    passesValidation: boolean,
    textContent: string,
    theme: any,
    project: any
  ) {
    const strengths = [];
    const issues = [];
    const recommendations = [];

    // Analyze brand consistency
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

    // Analyze quality
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

    // Check specific patterns
    if (textContent.match(/[!]{2,}/)) {
      issues.push({
        severity: "minor",
        category: "tone",
        description: "Excessive exclamation marks detected",
        suggestion: "Use a more professional tone",
      });
    }

    if (textContent.length < 50) {
      issues.push({
        severity: "minor",
        category: "clarity",
        description: "Content is very short",
        suggestion: "Consider adding more detail",
      });
    }

    // Generate recommendations
    if (brandConsistencyScore < 80) {
      recommendations.push(
        `Reference: ${theme.inspirations.slice(0, 2).join(", ")}`
      );
    }
    if (
      !textContent.toLowerCase().includes(project.customer_type.split(" ")[0])
    ) {
      recommendations.push(`Address audience: ${project.customer_type}`);
    }

    // Summary
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

