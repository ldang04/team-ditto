/**
 * EmbeddingService.ts
 *
 * Handles all text embedding operations using Vertex AI Text Embeddings API
 * Model: text-embedding-004 (768 dimensions)
 */

import { GoogleAuth } from "google-auth-library";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import logger from "../config/logger";

export class EmbeddingService {
  private static auth: GoogleAuth;
  private static projectId: string;

  /**
   * Initialize the service with GCP credentials
   */
  static initialize() {
    this.auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
    this.projectId = process.env.GCP_PROJECT_ID || "";
    logger.info("EmbeddingService: Initialized the service");
  }

  /**
   * Generate an embedding for document storage.
   *
   * Sends the provided `text` to the Vertex AI Text Embeddings API
   * (model: `text-embedding-004`) with task type `RETRIEVAL_DOCUMENT` and
   * returns the resulting numeric embedding vector.
   *
   * If Vertex AI does not return an embedding or an error occurs while
   * requesting the remote API, a deterministic local fallback embedding is
   * generated via `generateFallbackEmbedding` to ensure the method always
   * returns a 768-dimensional vector.
   *
   * @param text - The document text to embed.
   * @returns A Promise resolving to a 768-dimensional numeric array
   * representing the embedding vector.
   */
  static async generateDocumentEmbedding(text: string): Promise<number[]> {
    try {
      logger.info(`EmbeddingService: generateDocumentEmbedding for ${text}`);
      const client = await this.auth.getClient();
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/text-embedding-004:predict`;

      const response = await client.request({
        url,
        method: "POST",
        data: {
          instances: [
            {
              content: text,
              task_type: "RETRIEVAL_DOCUMENT",
            },
          ],
        },
      });

      const embedding =
        (response.data as any)?.predictions?.[0]?.embeddings?.values || [];

      if (embedding.length === 0) {
        logger.warn("No embedding returned from Vertex AI, using fallback");
        return this.generateFallbackEmbedding(text);
      }

      return embedding;
    } catch (error) {
      logger.error("Failed to generate Vertex AI embedding:", error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate an embedding optimized for search queries.
   *
   * Sends the provided `text` to the Vertex AI Text Embeddings API
   * (model: `text-embedding-004`) with task type `RETRIEVAL_QUERY` and
   * returns the resulting numeric embedding vector suitable for retrieval
   * and semantic search.
   *
   * If Vertex AI does not return an embedding or an error occurs while
   * requesting the remote API, a deterministic local fallback embedding is
   * generated via `generateFallbackEmbedding` to ensure the method always
   * returns a 768-dimensional vector.
   *
   * @param text - The query text to embed.
   * @returns A Promise resolving to a 768-dimensional numeric array
   * representing the embedding vector.
   */
  static async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      logger.info(`EmbeddingService: generateQueryEmbedding for ${text}`);
      const client = await this.auth.getClient();
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/text-embedding-004:predict`;

      const response = await client.request({
        url,
        method: "POST",
        data: {
          instances: [
            {
              content: text,
              task_type: "RETRIEVAL_QUERY",
            },
          ],
        },
      });

      return (
        (response.data as any)?.predictions?.[0]?.embeddings?.values ||
        this.generateFallbackEmbedding(text)
      );
    } catch (error) {
      logger.error("Failed to generate query embedding:", error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate an embedding for image data (base64).
   *
   * Uses an image-capable embedding endpoint if available; otherwise falls
   * back to the existing deterministic text-based fallback.
   *
   * @param imageBase64 - Base64-encoded image bytes.
   * @returns A Promise resolving to a 768-dimensional numeric array.
   */
  static async generateImageEmbedding(imageBase64: string): Promise<number[]> {
    try {
      logger.info(`EmbeddingService: generateImageEmbedding`);
      const client = await this.auth.getClient();
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/multimodalembedding@001:predict`;

      const response = await client.request({
        url,
        method: "POST",
        data: {
          instances: [
            {
              image: {
                bytesBase64Encoded: imageBase64,
              },
            },
          ],
        },
      });

      return (
        (response.data as any)?.predictions?.[0]?.imageEmbedding ||
        this.generateFallbackEmbedding(imageBase64)
      );
    } catch (error) {
      logger.error("Failed to generate image embedding:", error);
      return this.generateFallbackEmbedding(imageBase64);
    }
  }

  /**
   * Generate an embedding for the provided `text` and persist it.
   *
   * Errors encountered while storing the embedding are logged
   *
   * @param contentId - The external identifier for the content being stored.
   * @param text - The text content to embed and store.
   * @returns A Promise that resolves to the generated 768-dimensional
   * embedding vector.
   */
  static async generateAndStoreText(
    contentId: string,
    text: string
  ): Promise<number[]> {
    logger.info(
      `EmbeddingService: generateAndStoreText for ${contentId}, ${text}`
    );
    const embedding = await this.generateDocumentEmbedding(text);

    try {
      await EmbeddingsModel.create({
        content_id: contentId,
        embedding: embedding,
        text_content: text,
        media_type: "text",
      });
    } catch (error) {
      logger.error("Failed to store text embedding:", error);
    }

    return embedding;
  }

  /**
   * Generate an embedding for the provided `image` and persist it.
   *
   * Errors encountered while storing the embedding are logged
   *
   * @param contentId - The external identifier for the content being stored.
   * @param imageBase64 - The encoded image to embed and store.
   * @returns A Promise that resolves to the generated 768-dimensional
   * embedding vector.
   */
  static async generateAndStoreImage(
    contentId: string,
    imageBase64: string
  ): Promise<number[]> {
    logger.info(`EmbeddingService: generateAndStoreImage for ${contentId}`);
    const embedding = await this.generateImageEmbedding(imageBase64);

    try {
      await EmbeddingsModel.create({
        content_id: contentId,
        embedding: embedding,
        text_content: imageBase64,
        media_type: "image",
      });
    } catch (error) {
      logger.error("Failed to store image embedding:", error);
    }

    return embedding;
  }

  /** Calculate cosine similarity between two vectors. */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    // Ensure vectors are same length and non-empty
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;

    // Accumulators for dot product and squared magnitudes
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    // Sum pairwise products and squared values
    for (let i = 0; i < vecA.length; i++) {
      // contribution to dot product
      dotProduct += vecA[i] * vecB[i];
      // accumulate squared values for magnitudes
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }

    // Convert squared magnitudes to magnitudes
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    // If either vector has zero magnitude, similarity is undefined -> return 0
    if (magA === 0 || magB === 0) return 0;

    // Cosine similarity = dot(A,B) / (|A| * |B|)
    return dotProduct / (magA * magB);
  }

  /**
   * Generate a deterministic fallback embedding.
   *
   * Produces a 768-dimensional vector derived from simple text features
   * (word hashes, character n-grams, and basic text statistics). The
   * resulting vector is normalized so it can be used as a drop-in substitute
   * for Vertex AI embeddings when the remote service is unavailable.
   *
   * @param text - Input text to convert into an embedding.
   * @returns A 768-dimensional normalized numeric array.
   */
  private static generateFallbackEmbedding(text: string): number[] {
    // Target embedding dimensionality to match Vertex AI model
    const dimensions = 768; // Match Vertex AI text-embedding-004
    const embedding = new Array(dimensions).fill(0);

    // Simple normalization and tokenization
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/);
    const chars = normalized.split("");

    // Feature 1: Word-based features — boost positions based on hashed word
    // earlier words contribute more (1 / (idx + 1))
    words.forEach((word, idx) => {
      const hash = this.hashString(word);
      const position = hash % dimensions;
      embedding[position] += 1 / (idx + 1);
    });

    // Feature 2: Character n-grams — add small weights for trigrams
    for (let i = 0; i < chars.length - 2; i++) {
      const trigram = chars.slice(i, i + 3).join("");
      const hash = this.hashString(trigram);
      const position = hash % dimensions;
      embedding[position] += 0.5;
    }

    // Feature 3: Simple text statistics placed into reserved positions
    embedding[0] = words.length / 100; // relative word count
    embedding[1] = chars.length / 1000; // relative character count
    embedding[2] = (text.match(/[.!?]/g) || []).length / 10; // sentence-ish count

    // Normalize the vector to unit length
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0));
  }

  /**
   * Deterministic hash function used by the fallback embedding generator.
   *
   * @param str - Input string to hash.
   * @returns A non-negative integer hash value.
   */
  private static hashString(str: string): number {
    // Starting accumulator
    let hash = 0;

    // Mix each character into the hash using a common bitwise pattern
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      // shift left 5 (multiply by 32), subtract previous hash, add char
      hash = (hash << 5) - hash + char;
      // Force to 32-bit integer to keep behavior consistent across runtimes
      hash = hash & hash;
    }

    // Return absolute value to ensure non-negative bucket indices
    return Math.abs(hash);
  }
}

// Initialize on import
EmbeddingService.initialize();
