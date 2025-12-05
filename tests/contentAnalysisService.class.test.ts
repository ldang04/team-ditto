/**
 * ContentAnalysisService - Class and unit tests for marketing analysis
 *
 * Scope: This file acts as the class test for ContentAnalysisService by
 * exercising multiple public methods together, and also provides detailed
 * unit coverage for each method.
 *
 * Class integrations documented:
 * - Logger (src/config/logger): info/error logging during analysis and ranking
 * - EmbeddingService (src/services/EmbeddingService): semantic diversity via embeddings
 * - Theme (src/types): brand keyword extraction used in keyword density
 * - Internal composition: analyzeContent → readability + tone + keyword_density + structure
 *
 * Tests cover:
 * - Marketing readability (power words, CTAs, scannability)
 * - Marketing tone (urgency, benefits, social proof, emotional appeal)
 * - Keyword density
 * - Semantic diversity (with EmbeddingService mocked)
 * - Variant ranking with configurable weights
 * - analyzeContent composition (integration across methods)
 *
 * Equivalence Partitioning Map (Unit: ContentAnalysisService)
 *
 * analyzeMarketingReadability(text)
 * - R1 Valid: Persuasive marketing text → detects power words/CTA, strong/moderate
 * - R2 Valid Boundary: Very short sentences (<8 avg) → scannability penalty
 * - R3 Valid Boundary: Very long sentences (>25 avg) → scannability penalty
 * - R4 Atypical: Empty/whitespace text → score 0, level "weak"
 * - R5 Invalid: Non-string input → throws
 *
 * analyzeMarketingTone(text)
 * - T1 Valid: Persuasive text → higher persuasion label
 * - T2 Atypical: Neutral/bland → lower scores, "weak"/"moderate"
 * - T3 Boundary: Empty text → all zeros, label "weak"
 * - T4 Invalid: Non-string input → throws
 *
 * analyzeKeywordDensity(text, theme)
 * - K1 Valid: Text with theme keywords → non-zero count/percentage
 * - K2 Valid: Text without theme keywords → zero count/percentage
 * - K3 Boundary: Empty text → zero count/percentage, empty top_keywords
 * - K4 Invalid: Malformed theme (missing arrays) → throws
 *
 * analyzeStructure(text)
 * - STR1 Valid: Multiple sentences/paragraphs → correct counts and averages
 * - STR2 Boundary: Empty text → defaults (sentence_count=1, word_count=0, paragraph_count=0, avg_sentence_length=0)
 * - STR3 Invalid: Non-string input → throws
 *
 * analyzeDiversitySemantic(variants[, threshold])
 * - S1 Valid: Two+ variants → computes embeddings, semantic method
 * - S2 Valid: Single variant → diversity_score=100, method semantic
 * - S3 Atypical: Embedding failure → falls back to lexical method
 * - S4 Boundary: Similarity exactly at threshold → counted as duplicate
 * - S5 Invalid: Non-array or non-string variants → throws
 *
 * analyzeDiversity(variants[, threshold])
 * - L1 Valid: Two+ variants → lexical method metrics
 * - L2 Atypical: Identical variants → duplicate_pairs detected
 * - L3 Boundary: Similarity exactly at threshold → counted as duplicate
 * - L4 Invalid: Non-array or non-string variants → throws
 *
 * rankVariants(variants, analyses, qualityScores[, weights])
 * - V1 Valid: Ranks by composite score, includes factor breakdown
 * - V2 Valid: Custom weights change ordering accordingly
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import {
  ContentAnalysisService,
  ContentAnalysis,
} from "../src/services/ContentAnalysisService";
import { EmbeddingService } from "../src/services/EmbeddingService";
import logger from "../src/config/logger";
import { Theme } from "../src/types";

// Silence logger
jest.spyOn(logger, "info").mockImplementation(() => ({} as any));
jest.spyOn(logger, "error").mockImplementation(() => ({} as any));

// Mock EmbeddingService for semantic diversity tests
jest.mock("../src/services/EmbeddingService", () => ({
  EmbeddingService: {
    initialize: jest.fn(),
    generateDocumentEmbedding: jest.fn(),
    cosineSimilarity: jest.fn(),
  },
}));

describe("ContentAnalysisService", () => {
  const mockTheme: Theme = {
    id: "theme-1",
    name: "Modern Tech",
    font: "Roboto",
    tags: ["innovation", "professional", "trusted"],
    inspirations: ["Apple", "Google"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("analyzeMarketingReadability", () => {
    // R1 Valid: Persuasive text → detects power words/CTA, strong/moderate
    it("detects power words and calculates score (R1)", () => {
      const content =
        "Get started now with our amazing free trial. Discover powerful features today!";
      const result =
        ContentAnalysisService.analyzeMarketingReadability(content);

      expect(result.power_word_count).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
      expect(result.level).toBeDefined();
    });

    // R1 Valid: CTA presence increases score
    it("detects CTA presence (R1)", () => {
      const withCta = "Sign up today and get instant access!";
      const withoutCta = "Our product has many features.";

      const resultWithCta =
        ContentAnalysisService.analyzeMarketingReadability(withCta);
      const resultWithoutCta =
        ContentAnalysisService.analyzeMarketingReadability(withoutCta);

      expect(resultWithCta.has_cta).toBe(true);
      expect(resultWithoutCta.has_cta).toBe(false);
    });

    // R2/R3 Boundaries: Short vs long sentences affect scannability
    it("calculates scannability based on sentence length (R2/R3)", () => {
      // Short sentences = good scannability
      const scannable = "Short sentences. Easy to read. Quick to scan.";
      // Long run-on sentence = poor scannability
      const notScannable =
        "This is an extremely long sentence that goes on and on without any breaks making it very difficult to read and comprehend especially when displayed on a mobile screen where limited space makes long content hard to digest.";

      const scannableResult =
        ContentAnalysisService.analyzeMarketingReadability(scannable);
      const notScannableResult =
        ContentAnalysisService.analyzeMarketingReadability(notScannable);

      expect(scannableResult.scannability_score).toBeGreaterThan(
        notScannableResult.scannability_score
      );
    });

    // T2 Atypical: Bland text → weak level
    it("returns weak level for content with no power words or CTAs (T2)", () => {
      const bland = "The product exists. It does things. Users can use it.";
      const result = ContentAnalysisService.analyzeMarketingReadability(bland);

      expect(result.level).toBe("weak");
    });

    // R1 Valid: Persuasive content → strong level
    it("returns strong level for persuasive content (R1)", () => {
      const persuasive =
        "Get started now! Claim your exclusive free trial today. Transform your business with our powerful, proven solution.";
      const result =
        ContentAnalysisService.analyzeMarketingReadability(persuasive);

      expect(result.level).toBe("strong");
    });

    // R4 Atypical: Empty text → score 0, weak level
    it("handles empty content as weak readability (R4)", () => {
      const result = ContentAnalysisService.analyzeMarketingReadability("");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.level).toBe("weak");
    });

    // R5 Invalid: Non-string input → throws
    it("throws on non-string input (R5)", () => {
      expect(() =>
        ContentAnalysisService.analyzeMarketingReadability(123 as any)
      ).toThrow();
    });
  });

  describe("analyzeMarketingTone", () => {
    // T1 Valid: Urgent text → higher urgency score
    it("detects urgency indicators (T1)", () => {
      const urgent =
        "Act now! Limited time offer expires today. Hurry before it's gone!";
      const notUrgent = "Our service is available whenever you need it.";

      const urgentResult = ContentAnalysisService.analyzeMarketingTone(urgent);
      const notUrgentResult =
        ContentAnalysisService.analyzeMarketingTone(notUrgent);

      expect(urgentResult.urgency_score).toBeGreaterThan(
        notUrgentResult.urgency_score
      );
    });

    // T1 Valid: Benefit-focused vs feature-focused
    it("detects benefit-focused language (T1)", () => {
      const benefits =
        "You'll save time and money. Get more results with less effort. Transform your workflow.";
      const features = "The system has five modules and three integrations.";

      const benefitsResult =
        ContentAnalysisService.analyzeMarketingTone(benefits);
      const featuresResult =
        ContentAnalysisService.analyzeMarketingTone(features);

      expect(benefitsResult.benefit_score).toBeGreaterThan(
        featuresResult.benefit_score
      );
    });

    // T1 Valid: Social proof detection
    it("detects social proof language (T1)", () => {
      const socialProof =
        "Trusted by thousands of customers. Award-winning and certified. Join millions of satisfied users.";
      const noProof = "We made this product for people.";

      const proofResult =
        ContentAnalysisService.analyzeMarketingTone(socialProof);
      const noProofResult =
        ContentAnalysisService.analyzeMarketingTone(noProof);

      expect(proofResult.social_proof_score).toBeGreaterThan(
        noProofResult.social_proof_score
      );
    });

    // T1 Valid: Emotional appeal detection
    it("detects emotional appeal (T1)", () => {
      const emotional =
        "Love your work again. Stop feeling frustrated and overwhelmed. Finally find the solution you've been dreaming of.";
      const neutral = "The system processes data and generates reports.";

      const emotionalResult =
        ContentAnalysisService.analyzeMarketingTone(emotional);
      const neutralResult =
        ContentAnalysisService.analyzeMarketingTone(neutral);

      expect(emotionalResult.emotional_appeal).toBeGreaterThan(
        neutralResult.emotional_appeal
      );
    });

    // T1 Valid: Composite persuasion
    it("calculates overall persuasion score (T1)", () => {
      const highPersuasion =
        "Get your free trial now! You'll love how easy it is. Trusted by millions.";
      const result =
        ContentAnalysisService.analyzeMarketingTone(highPersuasion);

      expect(result.overall_persuasion).toBeGreaterThan(0);
      expect(result.label).toBeDefined();
    });

    // T2 Atypical: Non-persuasive → weak label
    it("returns weak label for non-persuasive content (T2)", () => {
      const bland = "This is a product. It exists.";
      const result = ContentAnalysisService.analyzeMarketingTone(bland);

      expect(result.label).toBe("weak");
    });

    // T3 Boundary: Empty text → zeros, weak label
    it("handles empty content (T3)", () => {
      const result = ContentAnalysisService.analyzeMarketingTone("");

      expect(result.urgency_score).toBe(0);
      expect(result.benefit_score).toBe(0);
      expect(result.overall_persuasion).toBe(0);
      expect(result.label).toBe("weak");
    });

    // T4 Invalid: Non-string input → throws
    it("throws on non-string input (T4)", () => {
      expect(() =>
        ContentAnalysisService.analyzeMarketingTone(123 as any)
      ).toThrow();
    });
  });

  describe("analyzeKeywordDensity", () => {
    // K1 Valid: Text containing brand keywords
    it("counts brand keyword occurrences (K1)", () => {
      const content =
        "Our innovation brings professional results. Innovation is at the core of what we do.";
      const result = ContentAnalysisService.analyzeKeywordDensity(
        content,
        mockTheme
      );

      expect(result.brand_keyword_count).toBeGreaterThan(0);
      expect(result.brand_keyword_percentage).toBeGreaterThan(0);
    });

    // K1 Valid: Top keywords extraction
    it("identifies top keywords excluding stop words (K1)", () => {
      const content =
        "Marketing marketing marketing design design content content content content";
      const result = ContentAnalysisService.analyzeKeywordDensity(
        content,
        mockTheme
      );

      expect(result.top_keywords.length).toBeGreaterThan(0);
      expect(result.top_keywords[0].word).toBe("content");
    });

    // K2 Valid: No brand keywords → zeros
    it("handles content with no brand keywords (K2)", () => {
      const content = "Random words that do not match any brand keywords.";
      const result = ContentAnalysisService.analyzeKeywordDensity(
        content,
        mockTheme
      );

      expect(result.brand_keyword_count).toBe(0);
      expect(result.brand_keyword_percentage).toBe(0);
    });
    // K3 Boundary: Empty text → zeros and empty top_keywords
    it("handles empty text (K3)", () => {
      const result = ContentAnalysisService.analyzeKeywordDensity(
        "",
        mockTheme
      );
      expect(result.brand_keyword_count).toBe(0);
      expect(result.brand_keyword_percentage).toBe(0);
      expect(Array.isArray(result.top_keywords)).toBe(true);
    });

    // K4 Invalid: Malformed theme (missing arrays) → throws
    it("throws on malformed theme (K4)", () => {
      const badTheme = { name: "X" } as any;
      expect(() =>
        ContentAnalysisService.analyzeKeywordDensity("text", badTheme)
      ).toThrow();
    });
  });

  describe("analyzeContent (integration)", () => {
    it("returns complete analysis structure", () => {
      const content =
        "Get your free trial now! Transform your business with our trusted, professional solution.";
      const result = ContentAnalysisService.analyzeContent(content, mockTheme);

      expect(result.readability).toBeDefined();
      expect(result.readability.score).toBeGreaterThanOrEqual(0);
      expect(result.readability.power_word_count).toBeDefined();
      expect(result.readability.has_cta).toBeDefined();

      expect(result.tone).toBeDefined();
      expect(result.tone.urgency_score).toBeGreaterThanOrEqual(0);
      expect(result.tone.benefit_score).toBeGreaterThanOrEqual(0);
      expect(result.tone.overall_persuasion).toBeGreaterThanOrEqual(0);

      expect(result.keyword_density).toBeDefined();
      expect(result.structure).toBeDefined();
      expect(result.structure.word_count).toBeGreaterThan(0);
    });
  });

  describe("analyzeStructure", () => {
    // STR1 Valid: Multiple sentences/paragraphs → correct counts
    it("counts sentences, words and paragraphs correctly (STR1)", () => {
      const text = "First one. Second one!\n\nThird one? Yes.";
      const result = ContentAnalysisService.analyzeStructure(text);

      expect(result.sentence_count).toBe(4);
      expect(result.paragraph_count).toBe(2);
      expect(result.word_count).toBeGreaterThan(0);
      expect(result.avg_sentence_length).toBeGreaterThan(0);
    });

    // STR2 Boundary: Empty text → zeros and defaults
    it("returns zeros for empty text (STR2)", () => {
      const result = ContentAnalysisService.analyzeStructure("");
      expect(result.sentence_count).toBe(1);
      expect(result.word_count).toBe(0);
      expect(result.paragraph_count).toBe(0);
      expect(result.avg_sentence_length).toBe(0);
    });

    // STR3 Invalid: Non-string input → throws
    it("throws on non-string input (STR3)", () => {
      expect(() =>
        ContentAnalysisService.analyzeStructure(123 as any)
      ).toThrow();
    });
  });

  describe("analyzeDiversitySemantic", () => {
    // S1 Valid: Uses embeddings for semantic similarity
    it("uses embeddings for semantic similarity (S1)", async () => {
      // Mock embeddings for two variants
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.4, 0.5, 0.6]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.3);

      const variants = ["Variant one content.", "Variant two content."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(
        variants
      );

      expect(EmbeddingService.generateDocumentEmbedding).toHaveBeenCalledTimes(
        2
      );
      expect(EmbeddingService.cosineSimilarity).toHaveBeenCalled();
      expect(result.method).toBe("semantic");
      expect(result.diversity_score).toBeGreaterThan(0);
    });

    // S1 Valid: Duplicates when similarity exceeds threshold
    it("detects duplicate pairs when similarity exceeds threshold (S1)", async () => {
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.95); // Very similar

      const variants = ["Same content.", "Same content."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(
        variants
      );

      expect(result.duplicate_pairs.length).toBeGreaterThan(0);
      expect(result.unique_variant_count).toBeLessThan(variants.length);
    });

    // S1 Valid: Very different content → high diversity
    it("returns high diversity for semantically different content (S1)", async () => {
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0, 1, 0]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.1); // Very different

      const variants = ["Tech article about AI.", "Recipe for chocolate cake."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(
        variants
      );

      expect(result.diversity_score).toBeGreaterThan(80);
      expect(result.duplicate_pairs.length).toBe(0);
    });

    // S3 Atypical: Embedding failure → lexical fallback
    it("falls back to lexical analysis when embedding fails (S3)", async () => {
      (
        EmbeddingService.generateDocumentEmbedding as jest.Mock
      ).mockRejectedValue(new Error("API error"));

      const variants = ["Variant one.", "Variant two."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(
        variants
      );

      expect(result.method).toBe("lexical");
    });

    // S2 Valid: Single variant → diversity 100, semantic method
    it("handles single variant (S2)", async () => {
      const result = await ContentAnalysisService.analyzeDiversitySemantic([
        "Only one.",
      ]);

      expect(result.diversity_score).toBe(100);
      expect(result.unique_variant_count).toBe(1);
      expect(result.duplicate_pairs.length).toBe(0);
    });
    // S4 Boundary: Similarity exactly at threshold → counted as duplicate
    it("counts duplicates at exact threshold (S4)", async () => {
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([0.1, 0.1, 0.1])
        .mockResolvedValueOnce([0.1, 0.1, 0.1]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.85);

      const variants = ["Same A.", "Same B."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(
        variants,
        0.85
      );

      expect(result.duplicate_pairs.length).toBeGreaterThan(0);
    });

    // S2 Valid: Empty variants array → diversity 100
    it("handles empty variants array (S2)", async () => {
      const result = await ContentAnalysisService.analyzeDiversitySemantic([]);
      expect(result.diversity_score).toBe(100);
      expect(result.unique_variant_count).toBe(0);
    });

    // S5 Invalid: Non-array or non-string variants → throws
    it("throws on invalid variants input (S5)", async () => {
      await expect(
        ContentAnalysisService.analyzeDiversitySemantic(123 as any)
      ).rejects.toThrow();

      await expect(
        ContentAnalysisService.analyzeDiversitySemantic(["ok", 1 as any])
      ).rejects.toThrow();
    });
  });

  describe("analyzeDiversity (lexical fallback)", () => {
    // L1 Valid: Jaccard overlap metrics
    it("uses Jaccard similarity for word overlap (L1)", () => {
      const variants = ["The quick brown fox.", "The slow gray wolf."];
      const result = ContentAnalysisService.analyzeDiversity(variants);

      expect(result.method).toBe("lexical");
      expect(result.avg_pairwise_similarity).toBeGreaterThan(0);
      expect(result.diversity_score).toBeGreaterThan(0);
    });

    // L2 Atypical: Identical content → duplicates
    it("detects identical content as duplicates (L2)", () => {
      const variants = ["Same exact content here.", "Same exact content here."];
      const result = ContentAnalysisService.analyzeDiversity(variants);

      expect(result.duplicate_pairs.length).toBeGreaterThan(0);
    });

    // L3 Boundary: Similarity exactly at threshold → counted as duplicate
    it("counts duplicates at exact lexical threshold (L3)", () => {
      const variants = ["Alpha beta gamma.", "Alpha beta gamma."];
      const result = ContentAnalysisService.analyzeDiversity(variants, 1.0);
      expect(result.duplicate_pairs.length).toBeGreaterThan(0);
    });

    // L4 Invalid: Non-array or non-string variants → throws
    it("throws on invalid variants input (L4)", () => {
      expect(() =>
        ContentAnalysisService.analyzeDiversity(123 as any)
      ).toThrow();
      expect(() =>
        ContentAnalysisService.analyzeDiversity(["ok", 1 as any])
      ).toThrow();
    });
  });

  describe("rankVariants", () => {
    const makeAnalysis = (
      readabilityScore: number,
      tonePersuasion: number,
      wordCount: number
    ): ContentAnalysis => ({
      readability: {
        score: readabilityScore,
        power_word_count: 3,
        has_cta: true,
        scannability_score: 80,
        level: "moderate",
      },
      tone: {
        urgency_score: 50,
        benefit_score: 60,
        social_proof_score: 30,
        emotional_appeal: 40,
        overall_persuasion: tonePersuasion,
        label: "strong",
      },
      keyword_density: {
        brand_keyword_count: 2,
        brand_keyword_percentage: 4,
        top_keywords: [],
      },
      structure: {
        sentence_count: 3,
        word_count: wordCount,
        avg_sentence_length: 17,
        paragraph_count: 1,
      },
    });

    // V1 Valid: Composite ranking best-first
    it("ranks variants by composite score (best first) (V1)", () => {
      const variants = ["A", "B", "C"];
      const analyses = [
        makeAnalysis(50, 50, 50), // Low
        makeAnalysis(80, 80, 100), // High
        makeAnalysis(60, 60, 75), // Medium
      ];
      const qualityScores = [60, 90, 70];

      const ranked = ContentAnalysisService.rankVariants(
        variants,
        analyses,
        qualityScores
      );

      expect(ranked[0].index).toBe(1); // Highest scoring variant
      expect(ranked[0].compositeScore).toBeGreaterThan(
        ranked[1].compositeScore
      );
      expect(ranked[1].compositeScore).toBeGreaterThan(
        ranked[2].compositeScore
      );
    });

    // V1 Valid: Includes factor breakdown
    it("includes factor breakdown in results (V1)", () => {
      const variants = ["Content"];
      const analyses = [makeAnalysis(70, 60, 100)];
      const qualityScores = [80];

      const ranked = ContentAnalysisService.rankVariants(
        variants,
        analyses,
        qualityScores
      );

      expect(ranked[0].factors).toBeDefined();
      expect(ranked[0].factors.base_quality).toBeDefined();
      expect(ranked[0].factors.marketing_readability).toBeDefined();
      expect(ranked[0].factors.marketing_tone).toBeDefined();
    });

    // V2 Valid: Custom weights change ordering
    it("allows custom weights (V2)", () => {
      const variants = ["A", "B"];
      const analyses = [
        makeAnalysis(100, 20, 50), // High readability, low tone
        makeAnalysis(20, 100, 50), // Low readability, high tone
      ];
      const qualityScores = [70, 70];

      // Custom weights: prioritize readability over tone
      const customWeights = {
        base_quality: 0.1,
        marketing_readability: 0.6,
        marketing_tone: 0.1,
        brand_keywords: 0.1,
        structure: 0.1,
      };

      const ranked = ContentAnalysisService.rankVariants(
        variants,
        analyses,
        qualityScores,
        customWeights
      );

      // With high readability weight, variant A (high readability) should rank first
      expect(ranked[0].index).toBe(0);
    });
  });
});
