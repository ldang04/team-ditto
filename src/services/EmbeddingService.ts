/**
 * EmbeddingService.ts
 * 
 * Handles all text embedding operations using Vertex AI Text Embeddings API
 * Model: text-embedding-004 (768 dimensions)
 */

import { GoogleAuth } from 'google-auth-library';
import { EmbeddingsModel } from '../models/EmbeddingsModel';

export class EmbeddingService {
  private static auth: GoogleAuth;
  private static projectId: string;

  /**
   * Initialize the service with GCP credentials
   */
  static initialize() {
    this.auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    this.projectId = process.env.GCP_PROJECT_ID || '';
  }

  /**
   * Generate embedding for document storage
   * Task type: RETRIEVAL_DOCUMENT
   */
  static async generateDocumentEmbedding(text: string): Promise<number[]> {
    try {
      const client = await this.auth.getClient();
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/text-embedding-004:predict`;
      
      const response = await client.request({
        url,
        method: 'POST',
        data: {
          instances: [
            {
              content: text,
              task_type: "RETRIEVAL_DOCUMENT"
            }
          ]
        }
      });

      const embedding = (response.data as any)?.predictions?.[0]?.embeddings?.values || [];
      
      if (embedding.length === 0) {
        console.warn("No embedding returned from Vertex AI, using fallback");
        return this.generateFallbackEmbedding(text);
      }

      return embedding;
    } catch (error) {
      console.warn("Failed to generate Vertex AI embedding:", error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate embedding for search queries
   * Task type: RETRIEVAL_QUERY
   */
  static async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      const client = await this.auth.getClient();
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/us-central1/publishers/google/models/text-embedding-004:predict`;
      
      const response = await client.request({
        url,
        method: 'POST',
        data: {
          instances: [
            {
              content: text,
              task_type: "RETRIEVAL_QUERY"
            }
          ]
        }
      });

      return (response.data as any)?.predictions?.[0]?.embeddings?.values || this.generateFallbackEmbedding(text);
    } catch (error) {
      console.warn("Failed to generate query embedding:", error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate embedding and store in database
   */
  static async generateAndStore(contentId: string, text: string): Promise<number[]> {
    const embedding = await this.generateDocumentEmbedding(text);

    try {
      await EmbeddingsModel.create({
        content_id: contentId,
        embedding: embedding,
        text_content: text
      });
    } catch (error) {
      console.error("Failed to store embedding:", error);
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) return 0;
    
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }
    
    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);
    
    if (magA === 0 || magB === 0) return 0;
    
    return dotProduct / (magA * magB);
  }

  /**
   * Fallback: Generate deterministic hash-based embedding
   * Creates 768-dimensional vector to match Vertex AI dimensions
   */
  private static generateFallbackEmbedding(text: string): number[] {
    const dimensions = 768; // Match Vertex AI text-embedding-004
    const embedding = new Array(dimensions).fill(0);
    
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/);
    const chars = normalized.split('');
    
    // Feature 1: Word-based features
    words.forEach((word, idx) => {
      const hash = this.hashString(word);
      const position = hash % dimensions;
      embedding[position] += 1 / (idx + 1);
    });
    
    // Feature 2: Character n-grams
    for (let i = 0; i < chars.length - 2; i++) {
      const trigram = chars.slice(i, i + 3).join('');
      const hash = this.hashString(trigram);
      const position = hash % dimensions;
      embedding[position] += 0.5;
    }
    
    // Feature 3: Text statistics
    embedding[0] = words.length / 100;
    embedding[1] = chars.length / 1000;
    embedding[2] = (text.match(/[.!?]/g) || []).length / 10;
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Hash function for fallback embedding
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Initialize on import
EmbeddingService.initialize();

