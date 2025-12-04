/**
 * controllers/RankingController.ts
 *
 * Handles ranking of content variants against project theme.
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

export const RankingController = {
  /**
   * Rank content items by their alignment with project theme and quality.
   *
   * @route POST /api/rank
   * @param {string} [req.body.project_id] - Project ID to rank all content for
   * @param {string[]} [req.body.content_ids] - Specific content IDs to rank
   * @param {number} [req.body.limit] - Limit number of results (optional)
   * @returns {Object} Ranked list of content with scores
   * @throws {400} If neither project_id nor content_ids provided
   * @throws {404} If project or content not found
   * @throws {500} If ranking fails
   */
  async rank(req: Request, res: Response) {
    try {
      logger.info(`${req.method} ${req.url} ${JSON.stringify(req.body)}`);

      const { project_id, content_ids, limit } = req.body;

      // Validate input: need either project_id OR content_ids
      if (
        !project_id &&
        (!content_ids || !Array.isArray(content_ids) || content_ids.length === 0)
      ) {
        const serviceResponse = ServiceResponse.failure(
          null,
          "Must provide either project_id OR content_ids array",
          StatusCodes.BAD_REQUEST
        );
        return handleServiceResponse(serviceResponse, res);
      }

      let contentsToRank: any[] = [];

      // Fetch content based on input
      if (content_ids && Array.isArray(content_ids)) {
        // Rank specific content IDs
        logger.info(`Ranking specific content IDs: ${content_ids.join(", ")}`);
        const { data: contents, error } = await ContentModel.getByIds(content_ids);
        if (error || !contents || contents.length === 0) {
          const serviceResponse = ServiceResponse.failure(
            null,
            "Content not found",
            StatusCodes.NOT_FOUND
          );
          return handleServiceResponse(serviceResponse, res);
        }
        contentsToRank = contents;
      } else if (project_id) {
        // Rank all content for project
        logger.info(`Ranking all content for project: ${project_id}`);
        const { data: contents, error } = await ContentModel.listByProject(project_id);
        if (error) {
          throw error;
        }
        contentsToRank = contents || [];
      }

      if (contentsToRank.length === 0) {
        const serviceResponse = ServiceResponse.success(
          {
            ranked_content: [],
            summary: {
              total_ranked: 0,
              message: "No content found to rank",
            },
          },
          "No content to rank",
          StatusCodes.OK
        );
        return handleServiceResponse(serviceResponse, res);
      }

      // Get project and theme for scoring (use first content's project_id)
      const firstProjectId = contentsToRank[0].project_id;
      const projectThemeData = await ProjectThemeService.getProjectAndTheme(
        firstProjectId
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

      // Score and rank each content item
      const rankedContent = await RankingController.scoreAndRankContent(
        contentsToRank,
        project,
        theme
      );

      // Apply limit if specified
      const limitedContent = limit
        ? rankedContent.slice(0, Number(limit))
        : rankedContent;

      // Calculate summary statistics
      const summary = {
        total_ranked: rankedContent.length,
        top_score: rankedContent.length > 0 ? rankedContent[0].overall_score : 0,
        average_score:
          rankedContent.length > 0
            ? Math.round(
                rankedContent.reduce(
                  (sum, item) => sum + item.overall_score,
                  0
                ) / rankedContent.length
              )
            : 0,
        project_id: project.id,
        theme_id: theme.id,
      };

      const serviceResponse = ServiceResponse.success(
        {
          ranked_content: limitedContent,
          summary,
        },
        "Content ranked successfully",
        StatusCodes.OK
      );

      return handleServiceResponse(serviceResponse, res);
    } catch (error: any) {
      logger.error("Error in RankingController.rank:", error);
      const serviceResponse = ServiceResponse.failure(error);
      return handleServiceResponse(serviceResponse, res);
    }
  },

  /**
   * Score and rank content items against project theme.
   *
   * @param contents - Array of content items to score
   * @param project - Project object
   * @param theme - Theme object
   * @returns Array of content items with scores, sorted by overall_score (descending)
   */
  async scoreAndRankContent(
    contents: any[],
    project: Project,
    theme: Theme
  ): Promise<any[]> {
    logger.info(`RankingController: Scoring ${contents.length} content items`);

    const scoredContent = await Promise.all(
      contents.map(async (content) => {
        try {
          // Get or generate content embedding
          let contentEmbedding: number[] = [];
          const { data: embeddingData } = await EmbeddingsModel.getByContentId(
            content.id!
          );

          if (embeddingData && embeddingData.length > 0) {
            contentEmbedding = embeddingData[0].embedding;
          } else if (content.text_content) {
            // Generate embedding if missing
            if (content.media_type === "image") {
              // For images, text_content contains base64 image data
              contentEmbedding =
                await EmbeddingService.generateImageEmbedding(
                  content.text_content
                );
            } else {
              // For text content, generate text embedding
              contentEmbedding =
                await EmbeddingService.generateDocumentEmbedding(
                  content.text_content
                );
            }
          }

          // Calculate brand consistency score
          const brandConsistencyScore =
            await RankingController.calculateBrandConsistency(
              contentEmbedding,
              project,
              theme
            );

          // Calculate quality score
          const qualityScore =
            content.media_type === "image"
              ? QualityScoringService.scoreImageQuality(
                  content.text_content || content.enhanced_prompt || "",
                  theme
                )
              : QualityScoringService.scoreTextQuality(
                  content.text_content || ""
                );

          // Calculate overall score (60% brand, 40% quality)
          const overallScore = Math.round(
            brandConsistencyScore * 0.6 + qualityScore * 0.4
          );

          // Generate recommendation based on score
          const recommendation = RankingController.generateRecommendation(
            overallScore,
            brandConsistencyScore,
            qualityScore
          );

          return {
            rank: 0, // Will be set after sorting
            content_id: content.id,
            overall_score: overallScore,
            brand_consistency_score: brandConsistencyScore,
            quality_score: qualityScore,
            text_content: content.text_content,
            media_type: content.media_type,
            media_url: content.media_url,
            created_at: content.created_at,
            recommendation,
          };
        } catch (error) {
          logger.error(`Failed to score content ${content.id}:`, error);
          // Return with zero scores if scoring fails
          return {
            rank: 0,
            content_id: content.id,
            overall_score: 0,
            brand_consistency_score: 0,
            quality_score: 0,
            text_content: content.text_content,
            media_type: content.media_type,
            media_url: content.media_url,
            created_at: content.created_at,
            recommendation: "Unable to score content",
          };
        }
      })
    );

    // Sort by overall_score (descending) and assign ranks
    const ranked = scoredContent
      .sort((a, b) => b.overall_score - a.overall_score)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    logger.info(
      `RankingController: Ranked ${ranked.length} items, top score: ${
        ranked[0]?.overall_score || 0
      }`
    );

    return ranked;
  },

  /**
   * Calculate brand consistency score by comparing content embedding to theme.
   * Reuses logic from ValidationController.
   */
  async calculateBrandConsistency(
    contentEmbedding: number[],
    project: Project,
    theme: Theme
  ): Promise<number> {
    if (contentEmbedding.length === 0) {
      return 0;
    }

    // Build brand reference texts from theme (same as ValidationController)
    const brandTexts = [
      `${theme.name}: ${theme.tags?.join(", ") || ""}`,
      `Inspired by: ${theme.inspirations?.join(", ") || ""}`,
      `${project.description || ""}`,
      `Goals: ${project.goals || ""}`,
      `Target: ${project.customer_type || ""}`,
    ].filter(Boolean);

    if (brandTexts.length === 0) {
      return 0;
    }

    // Generate embeddings for brand references
    const brandEmbeddings = await Promise.all(
      brandTexts.map((text) =>
        EmbeddingService.generateDocumentEmbedding(text)
      )
    );

    // Compute cosine similarity
    const similarityScores = brandEmbeddings.map((brandEmb) =>
      EmbeddingService.cosineSimilarity(contentEmbedding, brandEmb)
    );

    // Average similarity and convert to percentage
    const avgSimilarity =
      similarityScores.reduce((sum, score) => sum + score, 0) /
      similarityScores.length;

    return Math.round(avgSimilarity * 100);
  },

  /**
   * Generate human-readable recommendation based on scores.
   */
  generateRecommendation(
    overallScore: number,
    brandScore: number,
    qualityScore: number
  ): string {
    if (overallScore >= 85) {
      return "Excellent - Best option with strong brand alignment and high quality";
    } else if (overallScore >= 70) {
      return "Good - Solid option that aligns well with brand guidelines";
    } else if (overallScore >= 50) {
      if (brandScore < 60) {
        return "Acceptable - Quality is good but brand alignment could be improved";
      } else {
        return "Acceptable - Brand alignment is good but quality could be improved";
      }
    } else {
      return "Needs improvement - Consider regenerating or refining this content";
    }
  },
};

