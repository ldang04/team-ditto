/**
 * services/ContentAnalysisService.ts
 *
 * Marketing-focused content analysis including:
 * - Marketing readability (power words, CTAs, scannability)
 * - Marketing tone analysis (urgency, benefits, social proof)
 * - Keyword density relative to brand
 * - Semantic diversity using embeddings (not just word overlap)
 *
 * These computations provide actionable insights for marketing content quality.
 */

import logger from "../config/logger";
import { Theme } from "../types";
import { EmbeddingService } from "./EmbeddingService";

/**
 * Detailed analysis result for a single piece of content.
 */
export interface ContentAnalysis {
  readability: {
    score: number; // 0-100, composite marketing readability
    power_word_count: number;
    has_cta: boolean;
    scannability_score: number; // 0-100
    level: string; // "weak" | "moderate" | "strong"
  };
  keyword_density: {
    brand_keyword_count: number;
    brand_keyword_percentage: number;
    top_keywords: Array<{ word: string; count: number }>;
  };
  tone: {
    urgency_score: number; // 0-100
    benefit_score: number; // 0-100
    social_proof_score: number; // 0-100
    emotional_appeal: number; // 0-100
    overall_persuasion: number; // 0-100 weighted composite
    label: string; // "weak" | "moderate" | "strong" | "very_strong"
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
  method: "semantic" | "lexical"; // indicates which method was used
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketing lexicons - research-backed word lists for marketing effectiveness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Power words that drive action in marketing copy.
 * Based on copywriting research (e.g., David Ogilvy, conversion optimization studies)
 */
const POWER_WORDS = new Set([
  // Urgency/Scarcity
  "now", "today", "instant", "immediately", "hurry", "limited", "exclusive",
  "deadline", "last", "final", "ending", "expires", "quick", "fast",
  // Value/Benefit
  "free", "bonus", "save", "discount", "deal", "value", "bargain", "affordable",
  "guaranteed", "proven", "results", "transform", "boost", "maximize", "unlock",
  // Trust/Authority
  "official", "certified", "expert", "professional", "trusted", "secure",
  "verified", "authentic", "endorsed", "recommended", "award", "leading",
  // Emotion
  "amazing", "incredible", "powerful", "revolutionary", "breakthrough",
  "discover", "secret", "revealed", "ultimate", "essential", "must-have",
  // Action
  "get", "start", "join", "try", "claim", "grab", "download", "access",
  "subscribe", "register", "book", "reserve", "order", "buy", "shop",
]);

/**
 * Call-to-action phrases and patterns
 */
const CTA_PATTERNS = [
  /\b(get|grab|claim|download|access|start|join|try|subscribe|sign up|register|book|reserve|order|buy|shop|learn more|find out|discover|see how|click|tap)\b/gi,
  /\b(don't miss|act now|limited time|while supplies last|offer ends|today only)\b/gi,
  /\b(free trial|no obligation|cancel anytime|money back|risk.?free)\b/gi,
];

/**
 * Urgency indicators for marketing copy
 */
const URGENCY_WORDS = new Set([
  "now", "today", "tonight", "immediately", "instant", "hurry", "rush",
  "limited", "exclusive", "only", "last", "final", "ending", "expires",
  "deadline", "countdown", "running out", "almost gone", "few left",
  "act fast", "don't wait", "before", "soon", "quick",
]);

/**
 * Benefit-focused language
 */
const BENEFIT_WORDS = new Set([
  "you", "your", "you'll", "you're", "yours",
  "save", "gain", "get", "receive", "enjoy", "discover", "achieve", "unlock",
  "improve", "enhance", "boost", "increase", "maximize", "optimize",
  "transform", "revolutionize", "simplify", "streamline",
  "benefit", "advantage", "value", "results", "success", "solution",
  "effortless", "easy", "simple", "convenient", "comfortable",
]);

/**
 * Social proof indicators
 */
const SOCIAL_PROOF_WORDS = new Set([
  "trusted", "proven", "verified", "certified", "endorsed", "recommended",
  "popular", "bestselling", "top-rated", "award-winning", "leading",
  "thousands", "millions", "customers", "users", "clients", "members",
  "testimonial", "review", "rating", "stars", "satisfied",
  "as seen", "featured", "mentioned", "used by", "chosen by",
]);

/**
 * Emotional trigger words
 */
const EMOTIONAL_WORDS = new Set([
  // Positive emotions
  "love", "happy", "joy", "excited", "thrilled", "delighted", "amazing",
  "wonderful", "fantastic", "incredible", "awesome", "brilliant",
  // Desire/aspiration
  "dream", "imagine", "wish", "desire", "aspire", "inspire", "motivated",
  // Fear/pain (used ethically to highlight problems solved)
  "worried", "frustrated", "struggling", "tired", "overwhelmed", "stuck",
  "missing out", "left behind", "falling behind",
  // Relief/solution
  "finally", "relief", "solved", "fixed", "overcome", "conquered",
]);

export class ContentAnalysisService {
  /**
   * Perform comprehensive marketing-focused analysis on content.
   *
   * @param content - The text content to analyze
   * @param theme - Theme for keyword analysis (brand keywords from tags/inspirations)
   * @returns ContentAnalysis with readability, keywords, tone, and structure
   */
  static analyzeContent(content: string, theme: Theme): ContentAnalysis {
    logger.info("ContentAnalysisService: Analyzing content");

    const readability = this.analyzeMarketingReadability(content);
    const keyword_density = this.analyzeKeywordDensity(content, theme);
    const tone = this.analyzeMarketingTone(content);
    const structure = this.analyzeStructure(content);

    return { readability, keyword_density, tone, structure };
  }

  /**
   * Analyze marketing-specific readability metrics.
   *
   * Unlike Flesch-Kincaid (designed for textbooks), this measures:
   * - Power word density (words that drive action)
   * - CTA presence and strength
   * - Scannability (short sentences, clear structure)
   *
   * @param text - Text to analyze
   * @returns Marketing readability scores
   */
  static analyzeMarketingReadability(
    text: string
  ): ContentAnalysis["readability"] {
    logger.info("ContentAnalysisService: Analyzing marketing readability");

    const words = this.getWords(text);
    const wordCount = words.length;
    const lowerText = text.toLowerCase();

    // Count power words
    let powerWordCount = 0;
    for (const word of words) {
      if (POWER_WORDS.has(word.toLowerCase())) {
        powerWordCount++;
      }
    }

    // Check for CTA patterns
    let ctaMatches = 0;
    for (const pattern of CTA_PATTERNS) {
      const matches = lowerText.match(pattern);
      if (matches) {
        ctaMatches += matches.length;
      }
    }
    const hasCta = ctaMatches > 0;

    // Calculate scannability (prefer shorter sentences, clear structure)
    const sentences = this.countSentences(text);
    const avgSentenceLength = sentences > 0 ? wordCount / sentences : wordCount;

    // Optimal marketing sentence length is 15-20 words
    // Penalize very long sentences (>25) and very short (<5)
    let scannabilityScore = 100;
    if (avgSentenceLength > 25) {
      scannabilityScore -= (avgSentenceLength - 25) * 3;
    } else if (avgSentenceLength < 8) {
      scannabilityScore -= (8 - avgSentenceLength) * 5;
    }

    // Bonus for paragraph breaks (indicates visual structure)
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      scannabilityScore += Math.min(10, paragraphs.length * 2);
    }

    scannabilityScore = Math.max(0, Math.min(100, Math.round(scannabilityScore)));

    // Composite readability score
    // Weight: 40% power words, 30% CTA presence, 30% scannability
    const powerWordScore = wordCount > 0
      ? Math.min(100, (powerWordCount / wordCount) * 500)
      : 0;
    const ctaScore = hasCta ? 100 : 0;

    const compositeScore = Math.round(
      powerWordScore * 0.4 + ctaScore * 0.3 + scannabilityScore * 0.3
    );

    // Classify level
    let level: string;
    if (compositeScore >= 70) {
      level = "strong";
    } else if (compositeScore >= 40) {
      level = "moderate";
    } else {
      level = "weak";
    }

    logger.info(
      `ContentAnalysisService: Marketing readability - score: ${compositeScore}, power words: ${powerWordCount}, has CTA: ${hasCta}`
    );

    return {
      score: compositeScore,
      power_word_count: powerWordCount,
      has_cta: hasCta,
      scannability_score: scannabilityScore,
      level,
    };
  }

  /**
   * Analyze marketing tone for persuasion effectiveness.
   *
   * Measures key persuasion factors:
   * - Urgency: Creates time pressure
   * - Benefits: Focuses on customer value (not features)
   * - Social proof: Leverages trust signals
   * - Emotional appeal: Connects emotionally
   *
   * @param text - Text to analyze
   * @returns Marketing tone scores
   */
  static analyzeMarketingTone(text: string): ContentAnalysis["tone"] {
    logger.info("ContentAnalysisService: Analyzing marketing tone");

    const words = this.getWords(text).map((w) => w.toLowerCase());
    const wordCount = words.length;

    if (wordCount === 0) {
      return {
        urgency_score: 0,
        benefit_score: 0,
        social_proof_score: 0,
        emotional_appeal: 0,
        overall_persuasion: 0,
        label: "weak",
      };
    }

    // Count matches for each category
    let urgencyCount = 0;
    let benefitCount = 0;
    let socialProofCount = 0;
    let emotionalCount = 0;

    for (const word of words) {
      if (URGENCY_WORDS.has(word)) urgencyCount++;
      if (BENEFIT_WORDS.has(word)) benefitCount++;
      if (SOCIAL_PROOF_WORDS.has(word)) socialProofCount++;
      if (EMOTIONAL_WORDS.has(word)) emotionalCount++;
    }

    // Convert to scores (0-100)
    // Optimal density varies by category - these thresholds are based on
    // copywriting best practices (3-5% for urgency, 5-8% for benefits)
    const urgencyScore = Math.min(100, (urgencyCount / wordCount) * 2000);
    const benefitScore = Math.min(100, (benefitCount / wordCount) * 1250);
    const socialProofScore = Math.min(100, (socialProofCount / wordCount) * 2500);
    const emotionalAppeal = Math.min(100, (emotionalCount / wordCount) * 1500);

    // Weighted composite - benefits are most important for marketing
    // Weights based on conversion optimization research:
    // - Benefits (35%): Most predictive of conversion
    // - Urgency (25%): Drives action but overuse is spammy
    // - Emotional (25%): Creates connection and memorability
    // - Social proof (15%): Important but often external (reviews, etc.)
    const overallPersuasion = Math.round(
      benefitScore * 0.35 +
      urgencyScore * 0.25 +
      emotionalAppeal * 0.25 +
      socialProofScore * 0.15
    );

    // Classify persuasion strength
    let label: string;
    if (overallPersuasion >= 70) {
      label = "very_strong";
    } else if (overallPersuasion >= 50) {
      label = "strong";
    } else if (overallPersuasion >= 30) {
      label = "moderate";
    } else {
      label = "weak";
    }

    logger.info(
      `ContentAnalysisService: Marketing tone - persuasion: ${overallPersuasion}, label: ${label}`
    );

    return {
      urgency_score: Math.round(urgencyScore),
      benefit_score: Math.round(benefitScore),
      social_proof_score: Math.round(socialProofScore),
      emotional_appeal: Math.round(emotionalAppeal),
      overall_persuasion: overallPersuasion,
      label,
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
   * Analyze semantic diversity between content variants using embeddings.
   *
   * Unlike Jaccard (word overlap), this measures actual semantic similarity
   * using vector embeddings. Two variants can use completely different words
   * but still be semantically similar (and vice versa).
   *
   * @param variants - Array of content strings
   * @param similarityThreshold - Threshold above which variants are duplicates (default 0.85)
   * @returns DiversityAnalysis with semantic similarity metrics
   */
  static async analyzeDiversitySemantic(
    variants: string[],
    similarityThreshold = 0.85
  ): Promise<DiversityAnalysis> {
    logger.info(
      `ContentAnalysisService: Analyzing semantic diversity of ${variants.length} variants`
    );

    if (variants.length < 2) {
      return {
        avg_pairwise_similarity: 0,
        diversity_score: 100,
        unique_variant_count: variants.length,
        duplicate_pairs: [],
        method: "semantic",
      };
    }

    try {
      // Generate embeddings for all variants
      const embeddings = await Promise.all(
        variants.map((v) => EmbeddingService.generateDocumentEmbedding(v))
      );

      const similarities: number[] = [];
      const duplicatePairs: Array<[number, number]> = [];

      // Calculate pairwise cosine similarity
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = EmbeddingService.cosineSimilarity(
            embeddings[i],
            embeddings[j]
          );
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
        `ContentAnalysisService: Semantic diversity score: ${diversityScore}, duplicates: ${duplicatePairs.length}`
      );

      return {
        avg_pairwise_similarity: Math.round(avgSimilarity * 100) / 100,
        diversity_score: diversityScore,
        unique_variant_count: uniqueCount,
        duplicate_pairs: duplicatePairs,
        method: "semantic",
      };
    } catch (error) {
      logger.error(
        "ContentAnalysisService: Semantic diversity failed, falling back to lexical",
        error
      );
      // Fall back to lexical analysis if embedding fails
      return this.analyzeDiversity(variants, similarityThreshold - 0.15);
    }
  }

  /**
   * Analyze diversity using lexical (word overlap) method.
   * Used as fallback when semantic analysis is unavailable.
   *
   * @param variants - Array of content strings
   * @param similarityThreshold - Threshold above which variants are duplicates (default 0.7)
   * @returns DiversityAnalysis with Jaccard similarity metrics
   */
  static analyzeDiversity(
    variants: string[],
    similarityThreshold = 0.7
  ): DiversityAnalysis {
    logger.info(
      `ContentAnalysisService: Analyzing lexical diversity of ${variants.length} variants`
    );

    if (variants.length < 2) {
      return {
        avg_pairwise_similarity: 0,
        diversity_score: 100,
        unique_variant_count: variants.length,
        duplicate_pairs: [],
        method: "lexical",
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
      `ContentAnalysisService: Lexical diversity score: ${diversityScore}, duplicates: ${duplicatePairs.length}`
    );

    return {
      avg_pairwise_similarity: Math.round(avgSimilarity * 100) / 100,
      diversity_score: diversityScore,
      unique_variant_count: uniqueCount,
      duplicate_pairs: duplicatePairs,
      method: "lexical",
    };
  }

  /**
   * Rank variants by marketing effectiveness.
   *
   * Weight rationale (based on conversion optimization research):
   * - Base quality (25%): Technical correctness and coherence
   * - Marketing readability (25%): Power words, CTAs, scannability
   * - Marketing tone (30%): Persuasion effectiveness (benefits, urgency, emotion)
   * - Brand keywords (10%): On-brand messaging
   * - Structure (10%): Appropriate length and formatting
   *
   * @param variants - Array of content strings
   * @param analyses - Corresponding ContentAnalysis for each variant
   * @param qualityScores - Base quality scores from QualityScoringService
   * @param weights - Optional custom weights for ranking factors
   * @returns Sorted indices and composite scores
   */
  static rankVariants(
    variants: string[],
    analyses: ContentAnalysis[],
    qualityScores: number[],
    weights?: Partial<RankingWeights>
  ): Array<{
    index: number;
    compositeScore: number;
    factors: Record<string, number>;
  }> {
    logger.info("ContentAnalysisService: Ranking variants");

    // Default weights with documented rationale
    const defaultWeights: RankingWeights = {
      base_quality: 0.25, // Technical correctness
      marketing_readability: 0.25, // Power words, CTAs, scannability
      marketing_tone: 0.30, // Persuasion (most predictive of conversion)
      brand_keywords: 0.10, // On-brand messaging
      structure: 0.10, // Length and formatting
    };

    const w = { ...defaultWeights, ...weights };

    const ranked = variants.map((_, index) => {
      const analysis = analyses[index];
      const baseQuality = qualityScores[index];

      // Calculate factor contributions (each normalized to 0-100)
      const factors = {
        base_quality: baseQuality * w.base_quality,
        marketing_readability: analysis.readability.score * w.marketing_readability,
        marketing_tone: analysis.tone.overall_persuasion * w.marketing_tone,
        brand_keywords:
          Math.min(analysis.keyword_density.brand_keyword_percentage * 10, 100) *
          w.brand_keywords,
        structure:
          Math.min(analysis.structure.word_count / 2, 100) * w.structure,
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

/**
 * Configurable weights for variant ranking.
 * All weights should sum to 1.0.
 */
export interface RankingWeights {
  base_quality: number;
  marketing_readability: number;
  marketing_tone: number;
  brand_keywords: number;
  structure: number;
}
