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
  relevantContents: Content[];
  similarDescriptions: string[];
  themeEmbedding: number[];
  avgSimilarity: number;
}

export class RAGService {
  /**
   * Perform RAG retrieval to get relevant context for generation.
   *
   * This method performs the following high-level steps:
   * 1. Generate an embedding for the user's prompt.
   * 2. Retrieve project content and load stored embeddings.
   * 3. Compute cosine similarity between the prompt embedding and each
   *    content embedding, then select the top-ranked items.
   * 4. Generate an embedding for the theme and return a `RAGContext`
   *    containing the selected content, descriptions, the theme embedding,
   *    and the average similarity across the returned items.
   *
   * If no project content exists, falls back to a theme-only context.
   * On any unexpected error the method returns an empty context.
   *
   * @param projectId - Identifier of the project whose content to search.
   * @param userPrompt - The user's prompt to embed and use for retrieval.
   * @param theme - Theme metadata used to build fallback context and theme embedding.
   * @returns A Promise resolving to a `RAGContext` with retrieval results.
   */
  static async performRAG(
    projectId: string,
    userPrompt: string,
    theme: Theme
  ): Promise<RAGContext> {
    logger.info(`RAGService: Performing RAG for project ${projectId}`);

    try {
      // 1) Embed the user's prompt for semantic retrieval
      const promptEmbedding = await EmbeddingService.generateQueryEmbedding(
        userPrompt
      );

      // 2) Retrieve content for the requested project from the DB
      const { data: projectContents, error } = await ContentModel.listByProject(
        projectId
      );

      // If there's no project content, return a theme-based context
      if (error || !projectContents || projectContents.length === 0) {
        logger.info("RAG: No content found, using theme only");
        const { themeText, themeEmbedding } = await this.generateThemeEmbedding(
          theme
        );

        // Return a minimal context: no content documents, but include the theme text
        // and its embedding so downstream generators still have meaningful context.
        return {
          relevantContents: [],
          similarDescriptions: [themeText],
          themeEmbedding,
          // When using only the theme as context, treat similarity as maximal
          avgSimilarity: 1.0,
        };
      }

      // 3) Load stored embeddings for each content item in parallel
      const contentsWithEmbedding = await Promise.all(
        projectContents.map(async (content) => {
          const { data: embeddingData } = await EmbeddingsModel.getByContentId(
            content.id!
          );
          const embedding =
            embeddingData && embeddingData.length > 0
              ? embeddingData[0].embedding
              : [];
          return { ...content, embedding };
        })
      );

      // 4) Compute cosine similarity between prompt and each content embedding
      const contentWithScores = contentsWithEmbedding
        .filter((item) => item.embedding.length > 0) // ignore items without embeddings
        .map((item) => ({
          ...item,
          similarity: EmbeddingService.cosineSimilarity(
            promptEmbedding,
            item.embedding
          ),
        }))
        .sort((a, b) => b.similarity - a.similarity); // sort descending by similarity

      // 5) Select top-N relevant items (top 5)
      const topContents = contentWithScores.slice(0, 5);

      // 6) Compute average similarity across the selected items
      const avgSimilarity =
        topContents.length > 0
          ? topContents.reduce((sum, item) => sum + item.similarity, 0) /
            topContents.length
          : 0;

      logger.info(
        `RAG: Retrieved ${
          topContents.length
        } items, avg similarity: ${avgSimilarity.toFixed(3)}`
      );

      // 7) Generate an embedding for the theme text to include in the context
      const { themeText, themeEmbedding } = await this.generateThemeEmbedding(
        theme
      );

      // 8) Build and return the RAGContext
      return {
        relevantContents: topContents,
        similarDescriptions: [
          ...topContents.map((item) => item.prompt),
          themeText,
        ],
        themeEmbedding,
        avgSimilarity,
      };
    } catch (error) {
      logger.error("RAG: Error during retrieval:", error);
      return this.generateEmptyContext();
    }
  }

  /**
   * Generate a compact theme description string and its embedding.
   *
   * @param theme - Theme object containing `name`, `tags`, and `inspirations`.
   * @returns A Promise resolving to an object with `themeText` (string)
   * and `themeEmbedding` (numeric embedding array).
   */
  private static async generateThemeEmbedding(
    theme: Theme
  ): Promise<{ themeText: string; themeEmbedding: number[] }> {
    logger.info(
      `RAGService: generating theme description and embedding for ${theme.id}`
    );
    // Compose a compact descriptive string from the theme metadata
    const themeText = `${theme.name}: ${theme.tags.join(
      ", "
    )} inspired by ${theme.inspirations.join(", ")}`;

    // Generate a document-style embedding for the composed theme text
    const themeEmbedding = await EmbeddingService.generateDocumentEmbedding(
      themeText
    );
    return { themeText, themeEmbedding };
  }

  /**
   * Generate an empty RAG context.
   *
   * @returns An object conforming to `RAGContext` with empty arrays and
   * zero similarity.
   */
  private static generateEmptyContext(): RAGContext {
    return {
      relevantContents: [],
      similarDescriptions: [],
      themeEmbedding: [],
      avgSimilarity: 0,
    };
  }
}
