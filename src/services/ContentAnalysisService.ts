/**
 * services/ContentAnalysisService.ts
 *
 * Advanced content analysis including:
 * - Readability scoring (Flesch-Kincaid)
 * - Keyword density analysis
 * - Sentiment analysis
 * - Variant diversity measurement
 *
 * These computations provide deeper insights into generated content quality
 * beyond simple heuristics.
 */

import logger from "../config/logger";
import { Theme } from "../types";

/**
 * Detailed analysis result for a single piece of content.
 */
export interface ContentAnalysis {
  readability: {
    score: number; // 0-100, higher = easier to read
    grade_level: number; // US grade level
    level: string; // "easy" | "moderate" | "difficult"
  };
  keyword_density: {
    brand_keyword_count: number;
    brand_keyword_percentage: number;
    top_keywords: Array<{ word: string; count: number }>;
  };
  sentiment: {
    score: number; // -1 to 1, negative to positive
    label: string; // "negative" | "neutral" | "positive"
    confidence: number; // 0-1
  };
  structure: {
    sentence_count: number;
    word_count: number;
    avg_sentence_length: number;
    paragraph_count: number;
  };
}

/**
 * Diversity analysis between multiple content variants.
 */
export interface DiversityAnalysis {
  avg_pairwise_similarity: number; // 0-1, lower = more diverse
  diversity_score: number; // 0-100, higher = more diverse
  unique_variant_count: number;
  duplicate_pairs: Array<[number, number]>; // indices of too-similar pairs
}

// Sentiment lexicons for basic sentiment analysis
const POSITIVE_WORDS = new Set([
  "good",
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "fantastic",
  "outstanding",
  "brilliant",
  "superb",
  "perfect",
  "love",
  "best",
  "happy",
  "beautiful",
  "innovative",
  "exciting",
  "powerful",
  "success",
  "successful",
  "premium",
  "quality",
  "professional",
  "trusted",
  "reliable",
  "efficient",
  "effective",
  "impressive",
  "remarkable",
  "exceptional",
  "superior",
]);

const NEGATIVE_WORDS = new Set([
  "bad",
  "poor",
  "terrible",
  "awful",
  "horrible",
  "worst",
  "hate",
  "disappointing",
  "failed",
  "failure",
  "problem",
  "issue",
  "difficult",
  "complicated",
  "confusing",
  "expensive",
  "slow",
  "broken",
  "error",
  "mistake",
  "wrong",
  "weak",
  "limited",
  "frustrating",
  "annoying",
]);

export class ContentAnalysisService {
  /**
   * Perform comprehensive analysis on a piece of content.
   *
   * @param content - The text content to analyze
   * @param theme - Theme for keyword analysis (brand keywords from tags/inspirations)
   * @returns ContentAnalysis with readability, keywords, sentiment, and structure
   */
  static analyzeContent(content: string, theme: Theme): ContentAnalysis {
    logger.info("ContentAnalysisService: Analyzing content");

    const readability = this.calculateReadability(content);
    const keyword_density = this.analyzeKeywordDensity(content, theme);
    const sentiment = this.analyzeSentiment(content);
    const structure = this.analyzeStructure(content);

    return { readability, keyword_density, sentiment, structure };
  }

  /**
   * Calculate Flesch-Kincaid readability metrics.
   *
   * Flesch Reading Ease formula:
   * 206.835 - 1.015 × (words/sentences) - 84.6 × (syllables/words)
   *
   * Flesch-Kincaid Grade Level:
   * 0.39 × (words/sentences) + 11.8 × (syllables/words) - 15.59
   *
   * @param text - Text to analyze
   * @returns Readability scores and classification
   */
  static calculateReadability(text: string): ContentAnalysis["readability"] {
    logger.info("ContentAnalysisService: Calculating readability");

    const sentences = this.countSentences(text);
    const words = this.getWords(text);
    const wordCount = words.length;
    const syllableCount = words.reduce(
      (sum, word) => sum + this.countSyllables(word),
      0
    );

    // Avoid division by zero
    if (wordCount === 0 || sentences === 0) {
      return { score: 0, grade_level: 0, level: "unknown" };
    }

    const avgWordsPerSentence = wordCount / sentences;
    const avgSyllablesPerWord = syllableCount / wordCount;

    // Flesch Reading Ease (0-100, higher = easier)
    const fleschScore =
      206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    const normalizedScore = Math.max(0, Math.min(100, Math.round(fleschScore)));

    // Flesch-Kincaid Grade Level
    const gradeLevel =
      0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
    const normalizedGrade = Math.max(0, Math.round(gradeLevel * 10) / 10);

    // Classify readability level
    let level: string;
    if (normalizedScore >= 70) {
      level = "easy";
    } else if (normalizedScore >= 50) {
      level = "moderate";
    } else {
      level = "difficult";
    }

    logger.info(
      `ContentAnalysisService: Readability - score: ${normalizedScore}, grade: ${normalizedGrade}`
    );

    return {
      score: normalizedScore,
      grade_level: normalizedGrade,
      level,
    };
  }

  /**
   * Analyze keyword density relative to brand keywords.
   *
   * @param text - Text to analyze
   * @param theme - Theme containing brand keywords (tags, inspirations)
   * @returns Keyword density metrics
   */
  static analyzeKeywordDensity(
    text: string,
    theme: Theme
  ): ContentAnalysis["keyword_density"] {
    logger.info("ContentAnalysisService: Analyzing keyword density");

    const words = this.getWords(text);
    const wordCount = words.length;
    const lowerText = text.toLowerCase();

    // Extract brand keywords from theme
    const brandKeywords = [
      ...theme.tags,
      ...theme.inspirations,
      ...theme.name.split(/\s+/),
    ]
      .map((k) => k.toLowerCase().trim())
      .filter((k) => k.length > 2);

    // Count brand keyword occurrences
    let brandKeywordCount = 0;
    for (const keyword of brandKeywords) {
      const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, "gi");
      const matches = lowerText.match(regex);
      if (matches) {
        brandKeywordCount += matches.length;
      }
    }

    const brandKeywordPercentage =
      wordCount > 0 ? (brandKeywordCount / wordCount) * 100 : 0;

    // Find top general keywords (word frequency)
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      const lower = word.toLowerCase();
      // Skip common stop words
      if (this.isStopWord(lower)) continue;
      wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
    }

    const topKeywords = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));

    logger.info(
      `ContentAnalysisService: Brand keyword count: ${brandKeywordCount}`
    );

    return {
      brand_keyword_count: brandKeywordCount,
      brand_keyword_percentage: Math.round(brandKeywordPercentage * 100) / 100,
      top_keywords: topKeywords,
    };
  }

  /**
   * Perform lexicon-based sentiment analysis.
   *
   * @param text - Text to analyze
   * @returns Sentiment score, label, and confidence
   */
  static analyzeSentiment(text: string): ContentAnalysis["sentiment"] {
    logger.info("ContentAnalysisService: Analyzing sentiment");

    const words = this.getWords(text).map((w) => w.toLowerCase());
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (POSITIVE_WORDS.has(word)) positiveCount++;
      if (NEGATIVE_WORDS.has(word)) negativeCount++;
    }

    const totalSentimentWords = positiveCount + negativeCount;
    const wordCount = words.length;

    // Calculate score (-1 to 1)
    let score = 0;
    if (totalSentimentWords > 0) {
      score = (positiveCount - negativeCount) / totalSentimentWords;
    }

    // Determine label
    let label: string;
    if (score > 0.2) {
      label = "positive";
    } else if (score < -0.2) {
      label = "negative";
    } else {
      label = "neutral";
    }

    // Confidence based on sentiment word coverage
    const confidence =
      wordCount > 0
        ? Math.min(1, (totalSentimentWords / wordCount) * 5)
        : 0;

    logger.info(
      `ContentAnalysisService: Sentiment - ${label} (score: ${score.toFixed(2)})`
    );

    return {
      score: Math.round(score * 100) / 100,
      label,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /**
   * Analyze text structure metrics.
   */
  static analyzeStructure(text: string): ContentAnalysis["structure"] {
    const sentences = this.countSentences(text);
    const words = this.getWords(text);
    const wordCount = words.length;
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

    return {
      sentence_count: sentences,
      word_count: wordCount,
      avg_sentence_length: sentences > 0 ? Math.round(wordCount / sentences) : 0,
      paragraph_count: paragraphs.length,
    };
  }

  /**
   * Analyze diversity between multiple content variants.
   * Uses Jaccard similarity on word sets to detect duplicates.
   *
   * @param variants - Array of content strings
   * @param similarityThreshold - Threshold above which variants are considered duplicates (default 0.7)
   * @returns DiversityAnalysis with similarity metrics
   */
  static analyzeDiversity(
    variants: string[],
    similarityThreshold = 0.7
  ): DiversityAnalysis {
    logger.info(
      `ContentAnalysisService: Analyzing diversity of ${variants.length} variants`
    );

    if (variants.length < 2) {
      return {
        avg_pairwise_similarity: 0,
        diversity_score: 100,
        unique_variant_count: variants.length,
        duplicate_pairs: [],
      };
    }

    // Convert each variant to a word set for Jaccard similarity
    const wordSets = variants.map(
      (v) => new Set(this.getWords(v).map((w) => w.toLowerCase()))
    );

    const similarities: number[] = [];
    const duplicatePairs: Array<[number, number]> = [];

    // Calculate pairwise Jaccard similarity
    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        const similarity = this.jaccardSimilarity(wordSets[i], wordSets[j]);
        similarities.push(similarity);

        if (similarity >= similarityThreshold) {
          duplicatePairs.push([i, j]);
        }
      }
    }

    const avgSimilarity =
      similarities.length > 0
        ? similarities.reduce((a, b) => a + b, 0) / similarities.length
        : 0;

    // Diversity score: inverse of similarity (0-100)
    const diversityScore = Math.round((1 - avgSimilarity) * 100);

    // Count unique variants (not in any duplicate pair)
    const duplicateIndices = new Set(duplicatePairs.flat());
    const uniqueCount = variants.length - duplicateIndices.size;

    logger.info(
      `ContentAnalysisService: Diversity score: ${diversityScore}, duplicates: ${duplicatePairs.length}`
    );

    return {
      avg_pairwise_similarity: Math.round(avgSimilarity * 100) / 100,
      diversity_score: diversityScore,
      unique_variant_count: uniqueCount,
      duplicate_pairs: duplicatePairs,
    };
  }

  /**
   * Rank variants by multiple quality factors.
   * Returns indices sorted by composite score (best first).
   *
   * @param variants - Array of content strings
   * @param analyses - Corresponding ContentAnalysis for each variant
   * @param qualityScores - Base quality scores from QualityScoringService
   * @returns Sorted indices and composite scores
   */
  static rankVariants(
    variants: string[],
    analyses: ContentAnalysis[],
    qualityScores: number[]
  ): Array<{ index: number; compositeScore: number; factors: Record<string, number> }> {
    logger.info("ContentAnalysisService: Ranking variants");

    const ranked = variants.map((_, index) => {
      const analysis = analyses[index];
      const baseQuality = qualityScores[index];

      // Weight factors for composite score
      const factors = {
        base_quality: baseQuality * 0.3,
        readability: analysis.readability.score * 0.2,
        sentiment_positive: (analysis.sentiment.score + 1) * 50 * 0.15, // Normalize to 0-100
        keyword_density: Math.min(analysis.keyword_density.brand_keyword_percentage * 10, 100) * 0.15,
        structure: Math.min(analysis.structure.word_count / 2, 100) * 0.1, // Prefer longer content up to 200 words
        sentence_variety: Math.min(analysis.structure.sentence_count * 10, 100) * 0.1,
      };

      const compositeScore = Math.round(
        Object.values(factors).reduce((sum, val) => sum + val, 0)
      );

      return { index, compositeScore, factors };
    });

    // Sort by composite score descending
    ranked.sort((a, b) => b.compositeScore - a.compositeScore);

    logger.info(
      `ContentAnalysisService: Top variant index: ${ranked[0]?.index}, score: ${ranked[0]?.compositeScore}`
    );

    return ranked;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper methods
  // ─────────────────────────────────────────────────────────────────────────

  private static getWords(text: string): string[] {
    return text.match(/\b[a-zA-Z]+\b/g) || [];
  }

  private static countSentences(text: string): number {
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : 1;
  }

  /**
   * Estimate syllable count using a simple heuristic.
   * Counts vowel groups, adjusting for silent e and common patterns.
   */
  private static countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    // Remove silent e at end
    word = word.replace(/(?:[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    return vowelGroups ? vowelGroups.length : 1;
  }

  private static jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
      "be", "have", "has", "had", "do", "does", "did", "will", "would",
      "could", "should", "may", "might", "must", "shall", "can", "this",
      "that", "these", "those", "i", "you", "he", "she", "it", "we", "they",
      "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
      "all", "each", "every", "both", "few", "more", "most", "other", "some",
      "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
      "very", "just", "also", "now", "here", "there", "then", "once", "your",
      "our", "their", "its", "my", "his", "her",
    ]);
    return stopWords.has(word);
  }
}
