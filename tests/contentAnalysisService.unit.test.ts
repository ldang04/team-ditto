/**
 * ContentAnalysisService - Unit tests for marketing analysis features
 *
 * Tests cover:
 * - Marketing readability (power words, CTAs, scannability)
 * - Marketing tone (urgency, benefits, social proof, emotional appeal)
 * - Keyword density
 * - Semantic diversity (with EmbeddingService mocked)
 * - Variant ranking with configurable weights
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import {
  ContentAnalysisService,
  ContentAnalysis,
  DiversityAnalysis,
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
    it("detects power words and calculates score", () => {
      const content = "Get started now with our amazing free trial. Discover powerful features today!";
      const result = ContentAnalysisService.analyzeMarketingReadability(content);

      expect(result.power_word_count).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0);
      expect(result.level).toBeDefined();
    });

    it("detects CTA presence", () => {
      const withCta = "Sign up today and get instant access!";
      const withoutCta = "Our product has many features.";

      const resultWithCta = ContentAnalysisService.analyzeMarketingReadability(withCta);
      const resultWithoutCta = ContentAnalysisService.analyzeMarketingReadability(withoutCta);

      expect(resultWithCta.has_cta).toBe(true);
      expect(resultWithoutCta.has_cta).toBe(false);
    });

    it("calculates scannability based on sentence length", () => {
      // Short sentences = good scannability
      const scannable = "Short sentences. Easy to read. Quick to scan.";
      // Long run-on sentence = poor scannability
      const notScannable = "This is an extremely long sentence that goes on and on without any breaks making it very difficult to read and comprehend especially when displayed on a mobile screen where limited space makes long content hard to digest.";

      const scannableResult = ContentAnalysisService.analyzeMarketingReadability(scannable);
      const notScannableResult = ContentAnalysisService.analyzeMarketingReadability(notScannable);

      expect(scannableResult.scannability_score).toBeGreaterThan(notScannableResult.scannability_score);
    });

    it("returns weak level for content with no power words or CTAs", () => {
      const bland = "The product exists. It does things. Users can use it.";
      const result = ContentAnalysisService.analyzeMarketingReadability(bland);

      expect(result.level).toBe("weak");
    });

    it("returns strong level for persuasive content", () => {
      const persuasive = "Get started now! Claim your exclusive free trial today. Transform your business with our powerful, proven solution.";
      const result = ContentAnalysisService.analyzeMarketingReadability(persuasive);

      expect(result.level).toBe("strong");
    });
  });

  describe("analyzeMarketingTone", () => {
    it("detects urgency indicators", () => {
      const urgent = "Act now! Limited time offer expires today. Hurry before it's gone!";
      const notUrgent = "Our service is available whenever you need it.";

      const urgentResult = ContentAnalysisService.analyzeMarketingTone(urgent);
      const notUrgentResult = ContentAnalysisService.analyzeMarketingTone(notUrgent);

      expect(urgentResult.urgency_score).toBeGreaterThan(notUrgentResult.urgency_score);
    });

    it("detects benefit-focused language", () => {
      const benefits = "You'll save time and money. Get more results with less effort. Transform your workflow.";
      const features = "The system has five modules and three integrations.";

      const benefitsResult = ContentAnalysisService.analyzeMarketingTone(benefits);
      const featuresResult = ContentAnalysisService.analyzeMarketingTone(features);

      expect(benefitsResult.benefit_score).toBeGreaterThan(featuresResult.benefit_score);
    });

    it("detects social proof language", () => {
      const socialProof = "Trusted by thousands of customers. Award-winning and certified. Join millions of satisfied users.";
      const noProof = "We made this product for people.";

      const proofResult = ContentAnalysisService.analyzeMarketingTone(socialProof);
      const noProofResult = ContentAnalysisService.analyzeMarketingTone(noProof);

      expect(proofResult.social_proof_score).toBeGreaterThan(noProofResult.social_proof_score);
    });

    it("detects emotional appeal", () => {
      const emotional = "Love your work again. Stop feeling frustrated and overwhelmed. Finally find the solution you've been dreaming of.";
      const neutral = "The system processes data and generates reports.";

      const emotionalResult = ContentAnalysisService.analyzeMarketingTone(emotional);
      const neutralResult = ContentAnalysisService.analyzeMarketingTone(neutral);

      expect(emotionalResult.emotional_appeal).toBeGreaterThan(neutralResult.emotional_appeal);
    });

    it("calculates overall persuasion score", () => {
      const highPersuasion = "Get your free trial now! You'll love how easy it is. Trusted by millions.";
      const result = ContentAnalysisService.analyzeMarketingTone(highPersuasion);

      expect(result.overall_persuasion).toBeGreaterThan(0);
      expect(result.label).toBeDefined();
    });

    it("returns weak label for non-persuasive content", () => {
      const bland = "This is a product. It exists.";
      const result = ContentAnalysisService.analyzeMarketingTone(bland);

      expect(result.label).toBe("weak");
    });

    it("handles empty content", () => {
      const result = ContentAnalysisService.analyzeMarketingTone("");

      expect(result.urgency_score).toBe(0);
      expect(result.benefit_score).toBe(0);
      expect(result.overall_persuasion).toBe(0);
      expect(result.label).toBe("weak");
    });
  });

  describe("analyzeKeywordDensity", () => {
    it("counts brand keyword occurrences", () => {
      const content = "Our innovation brings professional results. Innovation is at the core of what we do.";
      const result = ContentAnalysisService.analyzeKeywordDensity(content, mockTheme);

      expect(result.brand_keyword_count).toBeGreaterThan(0);
      expect(result.brand_keyword_percentage).toBeGreaterThan(0);
    });

    it("identifies top keywords excluding stop words", () => {
      const content = "Marketing marketing marketing design design content content content content";
      const result = ContentAnalysisService.analyzeKeywordDensity(content, mockTheme);

      expect(result.top_keywords.length).toBeGreaterThan(0);
      expect(result.top_keywords[0].word).toBe("content");
    });

    it("handles content with no brand keywords", () => {
      const content = "Random words that do not match any brand keywords.";
      const result = ContentAnalysisService.analyzeKeywordDensity(content, mockTheme);

      expect(result.brand_keyword_count).toBe(0);
      expect(result.brand_keyword_percentage).toBe(0);
    });
  });

  describe("analyzeContent (integration)", () => {
    it("returns complete analysis structure", () => {
      const content = "Get your free trial now! Transform your business with our trusted, professional solution.";
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

  describe("analyzeDiversitySemantic", () => {
    it("uses embeddings for semantic similarity", async () => {
      // Mock embeddings for two variants
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.4, 0.5, 0.6]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.3);

      const variants = ["Variant one content.", "Variant two content."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(variants);

      expect(EmbeddingService.generateDocumentEmbedding).toHaveBeenCalledTimes(2);
      expect(EmbeddingService.cosineSimilarity).toHaveBeenCalled();
      expect(result.method).toBe("semantic");
      expect(result.diversity_score).toBeGreaterThan(0);
    });

    it("detects duplicate pairs when similarity exceeds threshold", async () => {
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([0.1, 0.2, 0.3])
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.95); // Very similar

      const variants = ["Same content.", "Same content."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(variants);

      expect(result.duplicate_pairs.length).toBeGreaterThan(0);
      expect(result.unique_variant_count).toBeLessThan(variants.length);
    });

    it("returns high diversity for semantically different content", async () => {
      (EmbeddingService.generateDocumentEmbedding as jest.Mock)
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([0, 1, 0]);
      (EmbeddingService.cosineSimilarity as jest.Mock).mockReturnValue(0.1); // Very different

      const variants = ["Tech article about AI.", "Recipe for chocolate cake."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(variants);

      expect(result.diversity_score).toBeGreaterThan(80);
      expect(result.duplicate_pairs.length).toBe(0);
    });

    it("falls back to lexical analysis when embedding fails", async () => {
      (EmbeddingService.generateDocumentEmbedding as jest.Mock).mockRejectedValue(
        new Error("API error")
      );

      const variants = ["Variant one.", "Variant two."];
      const result = await ContentAnalysisService.analyzeDiversitySemantic(variants);

      expect(result.method).toBe("lexical");
    });

    it("handles single variant", async () => {
      const result = await ContentAnalysisService.analyzeDiversitySemantic(["Only one."]);

      expect(result.diversity_score).toBe(100);
      expect(result.unique_variant_count).toBe(1);
      expect(result.duplicate_pairs.length).toBe(0);
    });
  });

  describe("analyzeDiversity (lexical fallback)", () => {
    it("uses Jaccard similarity for word overlap", () => {
      const variants = ["The quick brown fox.", "The slow gray wolf."];
      const result = ContentAnalysisService.analyzeDiversity(variants);

      expect(result.method).toBe("lexical");
      expect(result.avg_pairwise_similarity).toBeGreaterThan(0);
      expect(result.diversity_score).toBeGreaterThan(0);
    });

    it("detects identical content as duplicates", () => {
      const variants = ["Same exact content here.", "Same exact content here."];
      const result = ContentAnalysisService.analyzeDiversity(variants);

      expect(result.duplicate_pairs.length).toBeGreaterThan(0);
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

    it("ranks variants by composite score (best first)", () => {
      const variants = ["A", "B", "C"];
      const analyses = [
        makeAnalysis(50, 50, 50), // Low
        makeAnalysis(80, 80, 100), // High
        makeAnalysis(60, 60, 75), // Medium
      ];
      const qualityScores = [60, 90, 70];

      const ranked = ContentAnalysisService.rankVariants(variants, analyses, qualityScores);

      expect(ranked[0].index).toBe(1); // Highest scoring variant
      expect(ranked[0].compositeScore).toBeGreaterThan(ranked[1].compositeScore);
      expect(ranked[1].compositeScore).toBeGreaterThan(ranked[2].compositeScore);
    });

    it("includes factor breakdown in results", () => {
      const variants = ["Content"];
      const analyses = [makeAnalysis(70, 60, 100)];
      const qualityScores = [80];

      const ranked = ContentAnalysisService.rankVariants(variants, analyses, qualityScores);

      expect(ranked[0].factors).toBeDefined();
      expect(ranked[0].factors.base_quality).toBeDefined();
      expect(ranked[0].factors.marketing_readability).toBeDefined();
      expect(ranked[0].factors.marketing_tone).toBeDefined();
    });

    it("allows custom weights", () => {
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
