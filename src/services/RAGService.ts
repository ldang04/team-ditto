/**
 * services/RAGService.ts
 * 
 * Handles Retrieval Augmented Generation (RAG) for content generation.
 */

import { ContentModel } from "../models/ContentModel";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import { EmbeddingService } from "./EmbeddingService";
import { Theme, Content } from "../types";
import logger from "../config/logger";

export interface RAGContext {
  relevantContent: Content[];
  similarDescriptions: string[];
  themeEmbedding: number[];
  contentEmbeddings: number[];
  avgSimilarity: number;
}

export class RAGService {
  /**
   * Perform RAG retrieval to get relevant context for generation
   */
  static async performRAG(
    projectId: string,
    userPrompt: string,
    theme: Theme
  ): Promise<RAGContext> {
    logger.info(`RAGService: Performing RAG for project ${projectId}`);

    try {
      // Generate embedding for user prompt
      const promptEmbedding = await EmbeddingService.generateQueryEmbedding(
        userPrompt
      );

      // Retrieve project content
      const { data: projectContent, error } = await ContentModel.listByProject(
        projectId
      );

      if (error || !projectContent || projectContent.length === 0) {
        logger.info("RAG: No content found, using theme only");
        return this.generateThemeBasedContext(theme);
      }

      // Get embeddings for all content
      const contentWithEmbeddings = await Promise.all(
        projectContent.map(async (content) => {
          const { data: embeddingData } = await EmbeddingsModel.getByContentId(
            content.id!
          );
          const embedding =
            embeddingData && embeddingData.length > 0
              ? embeddingData[0].embedding
              : [];
          return { content, embedding };
        })
      );

      // Calculate similarity scores
      const contentWithScores = contentWithEmbeddings
        .filter((item) => item.embedding.length > 0)
        .map((item) => ({
          ...item,
          similarity: EmbeddingService.cosineSimilarity(
            promptEmbedding,
            item.embedding
          ),
        }))
        .sort((a, b) => b.similarity - a.similarity);

      // Select top 5 most relevant
      const topContent = contentWithScores.slice(0, 5);

      // Calculate average similarity
      const avgSimilarity =
        topContent.length > 0
          ? topContent.reduce((sum, item) => sum + item.similarity, 0) /
            topContent.length
          : 0;

      // Generate theme embedding
      const themeText = `${theme.name}: ${theme.tags.join(", ")} inspired by ${theme.inspirations.join(", ")}`;
      const themeEmbedding = await EmbeddingService.generateDocumentEmbedding(
        themeText
      );

      logger.info(
        `RAG: Retrieved ${topContent.length} items, avg similarity: ${avgSimilarity.toFixed(3)}`
      );

      return {
        relevantContent: topContent.map((item) => item.content),
        similarDescriptions: topContent.map(
          (item) => item.content.text_content
        ),
        themeEmbedding,
        contentEmbeddings: topContent.map((item) => item.similarity),
        avgSimilarity,
      };
    } catch (error) {
      logger.error("RAG: Error during retrieval:", error);
      return this.generateEmptyContext();
    }
  }

  private static generateEmptyContext(): RAGContext {
    return {
      relevantContent: [],
      similarDescriptions: [],
      themeEmbedding: [],
      contentEmbeddings: [],
      avgSimilarity: 0,
    };
  }

  private static async generateThemeBasedContext(
    theme: Theme
  ): Promise<RAGContext> {
    const themeText = `${theme.name}: ${theme.tags.join(", ")} inspired by ${theme.inspirations.join(", ")}`;
    const themeEmbedding = await EmbeddingService.generateDocumentEmbedding(
      themeText
    );

    return {
      relevantContent: [],
      similarDescriptions: [themeText],
      themeEmbedding,
      contentEmbeddings: [],
      avgSimilarity: 1.0,
    };
  }
}

