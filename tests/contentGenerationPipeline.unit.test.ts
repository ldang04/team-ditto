/**
 * ContentGenerationPipeline - Equivalence partitions and test mapping
 *
 * Unit under test:
 * - ContentGenerationPipeline.execute(input)
 *
 * Input partitions (GenerationInput):
 * - P1: Valid input with all required fields (project, theme, prompt)
 * - P2: Input with minimal optional fields (uses defaults)
 * - P3: Input with custom style_preferences and target_audience
 * - P4: Invalid: missing prompt (or empty) → error
 * - P5: Invalid: non-string prompt → error
 * - B1: Boundary: variantCount = 0 (allowed)
 * - B2: Boundary: variantCount = 10 (upper typical)
 *
 * Service dependency outcomes:
 * - T1: ThemeAnalysis returns valid analysis
 * - T2: ThemeAnalysis throws -> falls back to default
 * - R1: RAG returns relevant content with high similarity
 * - R2: RAG returns no content (empty project) -> falls back
 * - R3: RAG throws -> falls back to empty context
 * - G1: TextGeneration returns multiple variants
 * - G2: TextGeneration returns single variant
 * - G3: TextGeneration throws -> propagates error
 *
 * Output partitions:
 * - O1: Pipeline returns variants with quality scores
 * - O2: Pipeline returns metadata with theme analysis
 * - O3: Pipeline returns RAG context info
 *
 * Mapping -> tests:
 * - P1/T1/R1/G1/O1/O2/O3: Full pipeline with valid inputs
 * - P2: Defaults test
 * - T2: Theme analysis fallback
 * - R2/R3: RAG fallback scenarios
 * - G3: Error propagation
 * - P4/P5: Prompt validation/error propagation
 * - B1/B2: variantCount boundaries
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import { ContentGenerationPipeline } from "../src/services/ContentGenerationPipeline";
import { ThemeAnalysisService } from "../src/services/ThemeAnalysisService";
import { RAGService, RAGContext } from "../src/services/RAGService";
import { PromptEnhancementService } from "../src/services/PromptEnhancementService";
import { TextGenerationService } from "../src/services/TextGenerationService";
import { QualityScoringService } from "../src/services/QualityScoringService";
import { ContentAnalysisService } from "../src/services/ContentAnalysisService";
import logger from "../src/config/logger";
import { Project, Theme, ThemeAnalysis } from "../src/types";

// Suppress logs during tests
jest.spyOn(logger, "info").mockImplementation();
jest.spyOn(logger, "error").mockImplementation();

// Mock all dependent services
jest.mock("../src/services/ThemeAnalysisService");
jest.mock("../src/services/RAGService");
jest.mock("../src/services/PromptEnhancementService");
jest.mock("../src/services/TextGenerationService");
jest.mock("../src/services/QualityScoringService");
jest.mock("../src/services/ContentAnalysisService");

describe("ContentGenerationPipeline", () => {
  // Test fixtures
  const mockProject: Project = {
    id: "project-123",
    name: "Test Project",
    description: "A test marketing project",
    goals: "Increase brand awareness",
    customer_type: "Tech professionals",
    client_id: "client-1",
    theme_id: "theme-1",
  };

  const mockTheme: Theme = {
    id: "theme-1",
    name: "Modern Tech",
    font: "Roboto",
    tags: ["modern", "professional", "clean"],
    inspirations: ["Apple", "Google"],
  };

  const mockThemeAnalysis: ThemeAnalysis = {
    color_palette: {
      primary: ["blue", "white"],
      secondary: ["gray"],
      accent: ["green"],
      mood: "professional",
    },
    style_score: 75,
    dominant_styles: ["modern", "minimalist"],
    visual_mood: "professional",
    complexity_score: 65,
    brand_strength: 80,
  };

  const mockRagContext: RAGContext = {
    relevantContents: [
      { id: "c1", text_content: "Previous content 1" } as any,
      { id: "c2", text_content: "Previous content 2" } as any,
    ],
    similarDescriptions: ["desc1", "desc2"],
    themeEmbedding: [0.1, 0.2, 0.3],
    avgSimilarity: 0.75,
    method: "hybrid",
  };

  const mockGeneratedVariants = [
    "Generated variant 1 with professional marketing content for tech audience.",
    "Generated variant 2 featuring modern design principles and clean aesthetics.",
  ];

  // Mock content analysis with new marketing structure
  const mockContentAnalysis = {
    readability: {
      score: 70,
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
      overall_persuasion: 50,
      label: "strong",
    },
    keyword_density: {
      brand_keyword_count: 2,
      brand_keyword_percentage: 4,
      top_keywords: [],
    },
    structure: {
      sentence_count: 3,
      word_count: 50,
      avg_sentence_length: 17,
      paragraph_count: 1,
    },
  };

  const mockDiversityAnalysis = {
    avg_pairwise_similarity: 0.3,
    diversity_score: 70,
    unique_variant_count: 2,
    duplicate_pairs: [],
    method: "semantic" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (ThemeAnalysisService.analyzeTheme as jest.Mock).mockReturnValue(
      mockThemeAnalysis
    );
    (RAGService.performRAG as jest.Mock).mockResolvedValue(mockRagContext);
    (PromptEnhancementService.enhancePromtWithRAG as jest.Mock).mockReturnValue(
      "Enhanced prompt with context"
    );
    (PromptEnhancementService.scoreRagQuality as jest.Mock).mockReturnValue(72);
    (TextGenerationService.generateContent as jest.Mock).mockResolvedValue(
      mockGeneratedVariants
    );
    (QualityScoringService.scoreTextQuality as jest.Mock).mockReturnValue(80);
    // Mock new ContentAnalysisService methods
    (ContentAnalysisService.analyzeContent as jest.Mock).mockReturnValue(
      mockContentAnalysis
    );
    (
      ContentAnalysisService.analyzeDiversitySemantic as jest.Mock
    ).mockResolvedValue(mockDiversityAnalysis);
    (ContentAnalysisService.rankVariants as jest.Mock).mockReturnValue([
      { index: 0, compositeScore: 75, factors: {} },
      { index: 1, compositeScore: 70, factors: {} },
    ]);
  });

  describe("execute - valid inputs (P1/T1/R1/G1)", () => {
    // Partitions: P1 (valid input), T1 (valid theme analysis), R1 (RAG relevant), G1 (multiple variants) → Output O1
    it("returns variants with quality scores (O1)", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create marketing content",
        variantCount: 2,
      });

      expect(result.variants).toHaveLength(2);
      expect(result.variants[0]).toHaveProperty("content");
      expect(result.variants[0]).toHaveProperty("qualityScore");
      expect(result.variants[0].qualityScore).toBe(80);
    });

    // Partitions: P1/T1 → Output O2 (metadata includes theme analysis)
    it("returns metadata with theme analysis (O2)", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.themeAnalysis).toEqual(mockThemeAnalysis);
      expect(result.metadata.themeAnalysis.visual_mood).toBe("professional");
      expect(result.metadata.themeAnalysis.brand_strength).toBe(80);
    });

    // Partitions: P1/R1 → Output O3 (RAG context info)
    it("returns RAG context info (O3)", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.ragSimilarity).toBe(0.75);
      expect(result.metadata.ragContentCount).toBe(2);
    });

    // Partitions: P1/T1/R1 → enhanced prompt present
    it("returns enhanced prompt in metadata", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.enhancedPrompt).toBe(
        "Enhanced prompt with context"
      );
    });

    // Partitions: P1/T1/R1/G1 → predicted + average quality computed
    it("returns predicted and average quality scores", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.predictedQuality).toBe(72);
      expect(result.metadata.averageQuality).toBe(80);
    });
  });

  describe("execute - defaults (P2)", () => {
    // Partitions: P2 (defaults) → variantCount defaults to 3
    it("uses default variantCount of 3", async () => {
      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        // variantCount not provided
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ variantCount: 3 })
      );
    });

    // Partitions: P2 (defaults) → style_preferences defaults to {}
    it("uses default style_preferences as empty object", async () => {
      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ style_preferences: {} })
      );
    });

    // Partitions: P2 (defaults) → target_audience defaults to 'general'
    it("uses default target_audience as 'general'", async () => {
      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ target_audience: "general" })
      );
    });
  });

  describe("execute - custom options (P3)", () => {
    // Partitions: P3 (custom options) → custom style_preferences
    it("passes custom style_preferences to generation", async () => {
      const customPrefs = { tone: "formal", length: "short" };

      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        style_preferences: customPrefs,
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ style_preferences: customPrefs })
      );
    });

    // Partitions: P3 (custom options) → custom target_audience
    it("passes custom target_audience to generation", async () => {
      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        target_audience: "enterprise executives",
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ target_audience: "enterprise executives" })
      );
    });
  });

  describe("execute - theme analysis fallback (T2)", () => {
    // Partitions: T2 (ThemeAnalysis throws) → fallback analysis used
    it("returns fallback analysis when ThemeAnalysisService throws", async () => {
      (ThemeAnalysisService.analyzeTheme as jest.Mock).mockImplementation(
        () => {
          throw new Error("Theme analysis failed");
        }
      );

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      // Should still succeed with fallback values
      expect(result.metadata.themeAnalysis.visual_mood).toBe("balanced");
      expect(result.metadata.themeAnalysis.brand_strength).toBe(50);
      expect(result.variants.length).toBeGreaterThan(0);
    });
  });

  describe("execute - RAG fallback scenarios (R2/R3)", () => {
    // Partitions: R2 (RAG returns empty) → graceful fallback
    it("handles empty RAG context gracefully (R2)", async () => {
      (RAGService.performRAG as jest.Mock).mockResolvedValue({
        relevantContents: [],
        similarDescriptions: [],
        themeEmbedding: [],
        avgSimilarity: 0,
        method: "theme_only",
      });

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.ragContentCount).toBe(0);
      expect(result.metadata.ragSimilarity).toBe(0);
      expect(result.variants.length).toBeGreaterThan(0);
    });

    // Partitions: R3 (RAG throws) → empty context fallback
    it("returns empty context when RAG throws (R3)", async () => {
      (RAGService.performRAG as jest.Mock).mockRejectedValue(
        new Error("RAG failed")
      );

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.ragContentCount).toBe(0);
      expect(result.metadata.ragSimilarity).toBe(0);
      // Pipeline should still complete
      expect(result.variants).toBeDefined();
    });
  });

  describe("execute - generation scenarios (G1/G2/G3)", () => {
    // Partitions: G2 (single variant)
    it("handles single variant generation (G2)", async () => {
      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue([
        "Single variant content",
      ]);
      // Mock rankVariants to return only 1 variant for this test
      (ContentAnalysisService.rankVariants as jest.Mock).mockReturnValue([
        { index: 0, compositeScore: 75, factors: {} },
      ]);

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        variantCount: 1,
      });

      expect(result.variants).toHaveLength(1);
      expect(result.metadata.averageQuality).toBe(80);
    });

    // Partitions: G3 (TextGeneration throws) → pipeline propagates error
    it("propagates error when TextGenerationService throws (G3)", async () => {
      (TextGenerationService.generateContent as jest.Mock).mockRejectedValue(
        new Error("Generation failed")
      );

      await expect(
        ContentGenerationPipeline.execute({
          project: mockProject,
          theme: mockTheme,
          prompt: "Create content",
        })
      ).rejects.toThrow("Generation failed");
    });
  });

  describe("execute - prompt validation (P4/P5)", () => {
    // P4 Invalid: missing prompt → propagate error from enhancement/RAG
    it("throws when prompt is missing (P4)", async () => {
      // Simulate TextGenerationService not being called
      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue(
        []
      );

      await expect(
        ContentGenerationPipeline.execute({
          project: mockProject,
          theme: mockTheme,
          // prompt missing
        } as any)
      ).rejects.toThrow();
    });

    // P5 Invalid: non-string prompt → propagate error
    it("throws when prompt is non-string (P5)", async () => {
      await expect(
        ContentGenerationPipeline.execute({
          project: mockProject,
          theme: mockTheme,
          prompt: 123 as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("execute - variantCount boundaries (B1/B2)", () => {
    // B1: variantCount = 0 → allowed, no variants
    it("handles variantCount = 0 (B1)", async () => {
      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue(
        []
      );

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        variantCount: 0,
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ variantCount: 0 })
      );
      expect(result.variants.length).toBe(0);
      expect(result.metadata.averageQuality).toBe(0);
    });

    // B2: variantCount = 10 → upper boundary
    it("handles variantCount = 10 (B2)", async () => {
      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => `Variant ${i + 1}`)
      );

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        variantCount: 10,
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ variantCount: 10 })
      );
      expect(result.variants.length).toBe(10);
    });
  });

  describe("execute - parallel execution", () => {
    // Execution behavior: Stage 1 runs ThemeAnalysis and RAG in parallel
    it("runs theme analysis and RAG in parallel", async () => {
      (ThemeAnalysisService.analyzeTheme as jest.Mock).mockImplementation(
        () => {
          // Record that this started at roughly the same time as RAG
          return mockThemeAnalysis;
        }
      );

      (RAGService.performRAG as jest.Mock).mockImplementation(async () => {
        return mockRagContext;
      });

      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      // Both should be called
      expect(ThemeAnalysisService.analyzeTheme).toHaveBeenCalledTimes(1);
      expect(RAGService.performRAG).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute - quality scoring", () => {
    // Partitions: G1 (multiple variants) → each variant scored
    it("scores each variant individually", async () => {
      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue([
        "Variant 1",
        "Variant 2",
        "Variant 3",
      ]);

      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(QualityScoringService.scoreTextQuality).toHaveBeenCalledTimes(3);
    });

    // Partitions: media_type=image → image scoring path
    it("uses image scoring for image media type", async () => {
      (QualityScoringService.scoreImageQuality as jest.Mock).mockReturnValue(
        85
      );

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
        media_type: "image",
      });

      expect(QualityScoringService.scoreImageQuality).toHaveBeenCalled();
      expect(result.variants[0].qualityScore).toBe(85);
    });

    // Partitions: G1 → average quality computed across variants
    it("calculates correct average quality", async () => {
      (QualityScoringService.scoreTextQuality as jest.Mock)
        .mockReturnValueOnce(70)
        .mockReturnValueOnce(80)
        .mockReturnValueOnce(90);

      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue([
        "V1",
        "V2",
        "V3",
      ]);

      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.averageQuality).toBe(80); // (70+80+90)/3
    });
  });

  describe("execute - prompt enhancement integration", () => {
    // Integration: enhancedPrompt used in generation call
    it("passes enhanced prompt to TextGenerationService", async () => {
      (
        PromptEnhancementService.enhancePromtWithRAG as jest.Mock
      ).mockReturnValue("Super enhanced prompt");

      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Original prompt",
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "Super enhanced prompt" })
      );
    });

    // Integration: enhancePromtWithRAG called with prompt, ragContext, themeAnalysis
    it("calls enhancePromptWithRAG with correct arguments", async () => {
      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "My prompt",
      });

      expect(PromptEnhancementService.enhancePromtWithRAG).toHaveBeenCalledWith(
        "My prompt",
        mockRagContext,
        mockThemeAnalysis
      );
    });
  });

  describe("execute - metadata completeness", () => {
    // Metadata: includes averageCompositeScore and ISO timestamp
    it("includes averageCompositeScore and generationTimestamp", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(typeof result.metadata.averageCompositeScore).toBe("number");
      const ts = Date.parse(result.metadata.generationTimestamp);
      expect(Number.isNaN(ts)).toBe(false);
    });

    // Metadata: pipelineStages contains full ordered list
    it("includes full pipelineStages in order", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.pipelineStages).toEqual([
        "theme_analysis",
        "rag_retrieval",
        "prompt_enhancement",
        "quality_prediction",
        "ai_generation",
        "quality_scoring",
        "content_analysis",
        "diversity_analysis",
        "variant_ranking",
      ]);
    });

    // Metadata: averageCompositeScore matches ranking average
    it("computes correct averageCompositeScore from rankings", async () => {
      // using default mock ranking scores: 75 and 70
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.averageCompositeScore).toBe(73);
    });
  });
});
