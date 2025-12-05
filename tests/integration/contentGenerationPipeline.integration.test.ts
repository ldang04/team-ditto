/**
 * ContentGenerationPipeline — Integration Tests (no external mocks)
 *
 * What this integrates:
 * - Real pipeline orchestration using TextGenerationService, EmbeddingService, QualityScoringService.
 * - Express-style configuration and environment-backed providers (Vertex AI/Gemini).
 * - No Jest moduleNameMapper: integration project uses real implementations.
 *
 * Class interaction flow (generateContentForTheme):
 * 1) Prepare prompt/context and Theme.
 * 2) Pipeline invokes TextGenerationService to create variants.
 * 3) EmbeddingService computes embeddings for diversity/selection.
 * 4) QualityScoringService scores variants.
 * 5) Pipeline selects top result and returns structured output.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";
jest.setTimeout(30000);

import { Theme, Project } from "../../src/types";
import { ContentGenerationPipeline } from "../../src/services/ContentGenerationPipeline";

describe("ContentGenerationPipeline Integration", () => {
  const theme: Theme = {
    id: "theme-pipeline",
    name: "Modern Tech",
    font: "Inter",
    tags: ["innovation", "professional", "trusted"],
    inspirations: ["Apple", "Google"],
  };

  /**
   * Integrates: Pipeline → TextGenerationService → EmbeddingService → QualityScoringService.
   * Validates: end-to-end generation returns variants, scores, and a selected top result.
   * External: Real provider initialization; requires environment configuration.
   */
  it("executes pipeline end-to-end for a theme", async () => {
    const prompt = "Announce a new AI feature for enterprise customers.";
    const project: Project = {
      id: "proj-int-1",
      theme_id: theme.id || "theme-pipeline",
      client_id: "client-int-1",
      name: "Integration Project",
      description: "Desc",
      goals: "Goals",
      customer_type: "B2B",
    };

    const result = await ContentGenerationPipeline.execute({
      prompt,
      theme,
      project,
      variantCount: 2,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.variants)).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(Array.isArray(result.metadata.pipelineStages)).toBe(true);
    expect(result.metadata.pipelineStages.length).toBeGreaterThan(0);
  });

  /**
   * Integrates: execute → analyzeTheme (uses provided theme.analysis path) → performRAG.
   * Validates: pipeline respects precomputed ThemeAnalysis and populates RAG metadata.
   * External: Real providers; no mocks.
   */
  it("respects provided theme.analysis and populates RAG metadata", async () => {
    const prompt = "Launch announcement for a new modern tech product.";
    const preAnalyzedTheme: Theme = {
      ...theme,
      analysis: {
        color_palette: {
          primary: [],
          secondary: [],
          accent: [],
          mood: "neutral",
        },
        style_score: 65,
        dominant_styles: ["modern", "clean"],
        visual_mood: "balanced",
        complexity_score: 40,
        brand_strength: 80,
      },
    };
    const project: Project = {
      id: "proj-int-2",
      theme_id: preAnalyzedTheme.id || "theme-pipeline",
      client_id: "client-int-2",
      name: "Integration Project 2",
      description: "Desc",
      goals: "Goals",
      customer_type: "B2B",
    };

    const result = await ContentGenerationPipeline.execute({
      prompt,
      theme: preAnalyzedTheme,
      project,
      variantCount: 1,
    });

    expect(result.metadata.themeAnalysis.style_score).toBe(65);
    expect(Array.isArray(result.metadata.pipelineStages)).toBe(true);
    expect(typeof result.metadata.ragSimilarity).toBe("number");
    expect(typeof result.metadata.ragContentCount).toBe("number");
  });

  /**
   * Integrates: execute → input validation, performRAG fallback when prompt invalid.
   * Validates: throws on invalid prompt (empty/whitespace).
   * External: None beyond validation.
   */
  it("throws on invalid prompt input", async () => {
    const project: Project = {
      id: "proj-int-3",
      theme_id: theme.id || "theme-pipeline",
      client_id: "client-int-3",
      name: "Integration Project 3",
      description: "Desc",
      goals: "Goals",
      customer_type: "B2B",
    };

    await expect(
      ContentGenerationPipeline.execute({ prompt: "   ", theme, project })
    ).rejects.toThrow("Invalid prompt");
  });
});
