/**
 * services/RAGService.ts
 *
 * Handles Retrieval Augmented Generation (RAG) for content generation.
 *
 * Implements production-grade RAG techniques:
 * - BM25: Classic keyword-based retrieval with TF-IDF weighting
 * - Hybrid Search: Combines BM25 + semantic embeddings via Reciprocal Rank Fusion
 * - MMR (Maximal Marginal Relevance): Balances relevance with diversity
 *
 * These techniques are based on 2025 RAG best practices used by production
 * systems like Pinecone, Weaviate, and enterprise search engines.
 */

import { ContentModel } from "../models/ContentModel";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import { EmbeddingService } from "./EmbeddingService";
import { Theme, Content } from "../types";
import logger from "../config/logger";

/**
 * Configuration for hybrid search and MMR algorithms.
 */
export interface RAGConfig {
  /** Number of candidates to retrieve before MMR reranking (default: 20) */
  candidatePoolSize: number;
  /** Final number of results after MMR selection (default: 5) */
  topK: number;
  /** MMR lambda: 0 = max diversity, 1 = max relevance (default: 0.7) */
  mmrLambda: number;
  /** RRF constant k for rank fusion (default: 60) */
  rrfK: number;
  /** BM25 parameters */
  bm25: {
    k1: number; // Term frequency saturation (default: 1.5)
    b: number;  // Length normalization (default: 0.75)
  };
}

export const DEFAULT_RAG_CONFIG: RAGConfig = {
  candidatePoolSize: 20,
  topK: 5,
  mmrLambda: 0.7,
  rrfK: 60,
  bm25: { k1: 1.5, b: 0.75 },
};

export interface RAGContext {
  relevantContents: Content[];
  similarDescriptions: string[];
  themeEmbedding: number[];
  avgSimilarity: number;
  /** Retrieval method used */
  method: "hybrid" | "semantic" | "bm25" | "theme_only";
  /** Detailed retrieval metrics */
  metrics?: {
    bm25TopScore: number;
    semanticTopScore: number;
    hybridTopScore: number;
    diversityScore: number;
  };
}

export class RAGService {
  /**
   * Perform advanced RAG retrieval using Hybrid Search + MMR.
   *
   * Pipeline stages:
   * 1. Generate embedding for user's prompt
   * 2. Retrieve project content and load stored embeddings
   * 3. Compute BM25 scores (keyword-based relevance)
   * 4. Compute semantic similarity scores (embedding-based)
   * 5. Fuse rankings using Reciprocal Rank Fusion (RRF)
   * 6. Apply MMR to balance relevance with diversity
   * 7. Return enriched RAGContext with metrics
   *
   * @param projectId - Project whose content to search
   * @param userPrompt - User's prompt for retrieval
   * @param theme - Theme metadata for fallback context
   * @param config - Optional configuration for retrieval parameters
   */
  static async performRAG(
    projectId: string,
    userPrompt: string,
    theme: Theme,
    config: RAGConfig = DEFAULT_RAG_CONFIG
  ): Promise<RAGContext> {
    logger.info(`RAGService: Performing hybrid RAG for project ${projectId}`);

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

        return {
          relevantContents: [],
          similarDescriptions: [themeText],
          themeEmbedding,
          avgSimilarity: 1.0,
          method: "theme_only",
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

      // Filter items without embeddings
      const validContents = contentsWithEmbedding.filter(
        (item) => item.embedding.length > 0
      );

      if (validContents.length === 0) {
        logger.info("RAG: No valid embeddings, using theme only");
        const { themeText, themeEmbedding } = await this.generateThemeEmbedding(theme);
        return {
          relevantContents: [],
          similarDescriptions: [themeText],
          themeEmbedding,
          avgSimilarity: 0,
          method: "theme_only",
        };
      }

      // 4) Compute BM25 scores for keyword-based retrieval
      logger.info("RAG: Computing BM25 scores");
      const bm25Scores = this.computeBM25Scores(
        userPrompt,
        validContents.map((c) => c.text_content || c.prompt || ""),
        config.bm25
      );

      // 5) Compute semantic similarity scores
      logger.info("RAG: Computing semantic similarity scores");
      const semanticScores = validContents.map((item) =>
        EmbeddingService.cosineSimilarity(promptEmbedding, item.embedding)
      );

      // 6) Hybrid fusion using Reciprocal Rank Fusion (RRF)
      logger.info("RAG: Applying Reciprocal Rank Fusion");
      const hybridScores = this.reciprocalRankFusion(
        bm25Scores,
        semanticScores,
        config.rrfK
      );

      // Add scores to contents
      const scoredContents = validContents.map((content, i) => ({
        ...content,
        bm25Score: bm25Scores[i],
        semanticScore: semanticScores[i],
        hybridScore: hybridScores[i],
      }));

      // Sort by hybrid score and take candidate pool
      const candidatePool = [...scoredContents]
        .sort((a, b) => b.hybridScore - a.hybridScore)
        .slice(0, config.candidatePoolSize);

      // 7) Apply MMR for diversity
      logger.info("RAG: Applying Maximal Marginal Relevance");
      const mmrSelected = this.applyMMR(
        candidatePool,
        promptEmbedding,
        config.topK,
        config.mmrLambda
      );

      // 8) Calculate metrics
      const avgSimilarity =
        mmrSelected.length > 0
          ? mmrSelected.reduce((sum, item) => sum + item.semanticScore, 0) /
            mmrSelected.length
          : 0;

      const diversityScore = this.calculateDiversityScore(mmrSelected);

      logger.info(
        `RAG: Retrieved ${mmrSelected.length} items via hybrid+MMR, ` +
          `avg similarity: ${avgSimilarity.toFixed(3)}, diversity: ${diversityScore.toFixed(3)}`
      );

      // 9) Generate theme embedding
      const { themeText, themeEmbedding } = await this.generateThemeEmbedding(
        theme
      );

      // 10) Build and return enriched RAGContext
      return {
        relevantContents: mmrSelected,
        similarDescriptions: [
          ...mmrSelected.map((item) => item.prompt),
          themeText,
        ],
        themeEmbedding,
        avgSimilarity,
        method: "hybrid",
        metrics: {
          bm25TopScore: Math.max(...bm25Scores),
          semanticTopScore: Math.max(...semanticScores),
          hybridTopScore: Math.max(...hybridScores),
          diversityScore,
        },
      };
    } catch (error) {
      logger.error("RAG: Error during retrieval:", error);
      return this.generateEmptyContext();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BM25 Implementation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Compute BM25 scores for a query against a corpus of documents.
   *
   * BM25 (Best Matching 25) is a probabilistic retrieval model that extends
   * TF-IDF with:
   * - Term frequency saturation (via k1 parameter)
   * - Document length normalization (via b parameter)
   *
   * Formula: BM25(D, Q) = Σ IDF(qi) * (tf(qi, D) * (k1 + 1)) / (tf(qi, D) + k1 * (1 - b + b * |D|/avgdl))
   *
   * @param query - The search query
   * @param documents - Array of document texts
   * @param params - BM25 parameters (k1, b)
   * @returns Array of BM25 scores (one per document)
   */
  static computeBM25Scores(
    query: string,
    documents: string[],
    params: { k1: number; b: number } = { k1: 1.5, b: 0.75 }
  ): number[] {
    const { k1, b } = params;

    // Tokenize query and documents
    const queryTerms = this.tokenize(query);
    const docTokens = documents.map((doc) => this.tokenize(doc));

    // Calculate average document length
    const avgDocLength =
      docTokens.reduce((sum, tokens) => sum + tokens.length, 0) /
      Math.max(docTokens.length, 1);

    // Build document frequency map (how many docs contain each term)
    const docFreq: Map<string, number> = new Map();
    for (const tokens of docTokens) {
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
      }
    }

    const N = documents.length;

    // Calculate BM25 score for each document
    return docTokens.map((tokens) => {
      const docLength = tokens.length;

      // Build term frequency map for this document
      const termFreq: Map<string, number> = new Map();
      for (const term of tokens) {
        termFreq.set(term, (termFreq.get(term) || 0) + 1);
      }

      let score = 0;
      for (const queryTerm of queryTerms) {
        const tf = termFreq.get(queryTerm) || 0;
        if (tf === 0) continue;

        const df = docFreq.get(queryTerm) || 0;

        // IDF with smoothing to avoid log(0) and negative values
        // Using the standard BM25 IDF formula with +1 smoothing
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // BM25 term score with length normalization
        const termScore =
          (idf * (tf * (k1 + 1))) /
          (tf + k1 * (1 - b + b * (docLength / avgDocLength)));

        score += termScore;
      }

      return score;
    });
  }

  /**
   * Tokenize text into lowercase terms, removing stop words and punctuation.
   */
  static tokenize(text: string): string[] {
    const STOP_WORDS = new Set([
      "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
      "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
      "to", "was", "were", "will", "with", "the", "this", "but", "they",
      "have", "had", "what", "when", "where", "who", "which", "why", "how",
      "all", "each", "every", "both", "few", "more", "most", "other", "some",
      "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
      "very", "can", "just", "should", "now", "i", "you", "your", "we", "our",
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Remove punctuation
      .split(/\s+/)
      .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Reciprocal Rank Fusion (RRF)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Combine rankings from multiple retrieval methods using Reciprocal Rank Fusion.
   *
   * RRF is a robust rank fusion method that doesn't require score normalization.
   * Formula: RRF(d) = Σ 1 / (k + rank_i(d))
   *
   * where k is a constant (typically 60) that reduces the impact of high rankings.
   *
   * @param scores1 - Scores from first ranking method (e.g., BM25)
   * @param scores2 - Scores from second ranking method (e.g., semantic)
   * @param k - RRF constant (default: 60)
   * @returns Fused scores for each document
   */
  static reciprocalRankFusion(
    scores1: number[],
    scores2: number[],
    k: number = 60
  ): number[] {
    const n = scores1.length;

    // Get rankings (1-indexed) for each scoring method
    const ranks1 = this.scoreToRanks(scores1);
    const ranks2 = this.scoreToRanks(scores2);

    // Compute RRF scores
    return Array.from({ length: n }, (_, i) => {
      const rrf1 = 1 / (k + ranks1[i]);
      const rrf2 = 1 / (k + ranks2[i]);
      return rrf1 + rrf2;
    });
  }

  /**
   * Convert scores to ranks (1 = highest score).
   */
  private static scoreToRanks(scores: number[]): number[] {
    // Create array of [index, score] pairs
    const indexed = scores.map((score, i) => ({ i, score }));

    // Sort by score descending
    indexed.sort((a, b) => b.score - a.score);

    // Assign ranks (1-indexed)
    const ranks = new Array(scores.length);
    indexed.forEach((item, rank) => {
      ranks[item.i] = rank + 1;
    });

    return ranks;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Maximal Marginal Relevance (MMR)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Apply Maximal Marginal Relevance to select diverse, relevant results.
   *
   * MMR balances relevance to the query with diversity among selected documents.
   * Formula: MMR = λ * Sim(d, q) - (1-λ) * max(Sim(d, d_i)) for d_i in selected
   *
   * @param candidates - Pool of candidate documents with embeddings
   * @param queryEmbedding - Embedding of the query
   * @param topK - Number of documents to select
   * @param lambda - Trade-off parameter (0 = max diversity, 1 = max relevance)
   * @returns Selected documents after MMR
   */
  static applyMMR<T extends { embedding: number[]; hybridScore: number }>(
    candidates: T[],
    queryEmbedding: number[],
    topK: number,
    lambda: number = 0.7
  ): T[] {
    if (candidates.length === 0 || topK === 0) return [];
    if (candidates.length <= topK) return candidates;

    const selected: T[] = [];
    const remaining = [...candidates];

    // Select first document (highest hybrid score)
    const firstIdx = remaining.reduce(
      (maxIdx, item, idx, arr) =>
        item.hybridScore > arr[maxIdx].hybridScore ? idx : maxIdx,
      0
    );
    selected.push(remaining.splice(firstIdx, 1)[0]);

    // Iteratively select remaining documents using MMR
    while (selected.length < topK && remaining.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Relevance to query (using hybrid score as proxy, already combines BM25 + semantic)
        const relevance = candidate.hybridScore;

        // Maximum similarity to any already-selected document
        let maxSimToSelected = 0;
        for (const sel of selected) {
          const sim = EmbeddingService.cosineSimilarity(
            candidate.embedding,
            sel.embedding
          );
          maxSimToSelected = Math.max(maxSimToSelected, sim);
        }

        // MMR score
        const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(remaining.splice(bestIdx, 1)[0]);
    }

    return selected;
  }

  /**
   * Calculate diversity score for a set of documents.
   * Returns average pairwise dissimilarity (1 - similarity).
   */
  private static calculateDiversityScore<T extends { embedding: number[] }>(
    documents: T[]
  ): number {
    if (documents.length < 2) return 1.0;

    let totalDissimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const sim = EmbeddingService.cosineSimilarity(
          documents[i].embedding,
          documents[j].embedding
        );
        totalDissimilarity += 1 - sim;
        pairCount++;
      }
    }

    return pairCount > 0 ? totalDissimilarity / pairCount : 1.0;
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
      method: "theme_only",
    };
  }
}
