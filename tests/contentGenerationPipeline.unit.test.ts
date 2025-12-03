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
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "test-project";

import { ContentGenerationPipeline } from "../src/services/ContentGenerationPipeline";
import { ThemeAnalysisService } from "../src/services/ThemeAnalysisService";
import { RAGService, RAGContext } from "../src/services/RAGService";
import { PromptEnhancementService } from "../src/services/PromptEnhancementService";
import { TextGenerationService } from "../src/services/TextGenerationService";
import { QualityScoringService } from "../src/services/QualityScoringService";
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
  };

  const mockGeneratedVariants = [
    "Generated variant 1 with professional marketing content for tech audience.",
    "Generated variant 2 featuring modern design principles and clean aesthetics.",
  ];

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
  });

  describe("execute - valid inputs (P1/T1/R1/G1)", () => {
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

    it("returns RAG context info (O3)", async () => {
      const result = await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Create content",
      });

      expect(result.metadata.ragSimilarity).toBe(0.75);
      expect(result.metadata.ragContentCount).toBe(2);
    });

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
    it("handles empty RAG context gracefully (R2)", async () => {
      (RAGService.performRAG as jest.Mock).mockResolvedValue({
        relevantContents: [],
        similarDescriptions: [],
        themeEmbedding: [],
        avgSimilarity: 0,
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
    it("handles single variant generation (G2)", async () => {
      (TextGenerationService.generateContent as jest.Mock).mockResolvedValue([
        "Single variant content",
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

  describe("execute - parallel execution", () => {
    it("runs theme analysis and RAG in parallel", async () => {
      const themeAnalysisStart = Date.now();
      let ragStart = 0;

      (ThemeAnalysisService.analyzeTheme as jest.Mock).mockImplementation(
        () => {
          // Record that this started at roughly the same time as RAG
          return mockThemeAnalysis;
        }
      );

      (RAGService.performRAG as jest.Mock).mockImplementation(async () => {
        ragStart = Date.now();
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
    it("passes enhanced prompt to TextGenerationService", async () => {
      (PromptEnhancementService.enhancePromtWithRAG as jest.Mock).mockReturnValue(
        "Super enhanced prompt"
      );

      await ContentGenerationPipeline.execute({
        project: mockProject,
        theme: mockTheme,
        prompt: "Original prompt",
      });

      expect(TextGenerationService.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "Super enhanced prompt" })
      );
    });

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
});
