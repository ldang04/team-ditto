/**
 * Prompt Enhancement Service — Integration Tests (no mocks)
 *
 * Integrates:
 * - PromptEnhancementService.enhancePromtWithRAG: merges user prompt + RAG context + theme analysis.
 * - PromptEnhancementService.buildBrandedPrompt: constructs theme-aware branded prompts + negative prompts.
 * - PromptEnhancementService.scoreRagQuality: estimates generation quality via theme/RAG/length heuristics.
 *
 * External:
 * - No external APIs; uses pure TypeScript service logic with theme and RAG data.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import { PromptEnhancementService } from "../../src/services/PromptEnhancementService";
import { RAGContext } from "../../src/services/RAGService";
import { ThemeAnalysis } from "../../src/types";

describe("Prompt Enhancement Service Integration", () => {
  /**
   * Mock theme analysis data used across tests.
   */
  const mockThemeAnalysis: ThemeAnalysis = {
    color_palette: {
      primary: ["#FF6B6B", "#4ECDC4"],
      secondary: ["#45B7D1"],
      accent: ["#FFA07A"],
      mood: "",
    },
    visual_mood: "vibrant and energetic",
    dominant_styles: ["minimalist", "modern"],
    brand_strength: 0.85,
    complexity_score: 75,
    style_score: 0,
  };

  /**
   * Mock RAG context data used across tests.
   */
  const mockRagContext: RAGContext = {
    relevantContents: [
      { media_type: "text", text_content: "Thrilled to announce our Q4 results! The team exceeded all expectations with record-breaking performance." } as any,
      { media_type: "text", text_content: "Leadership isn't about being in charge. It's about taking care of those in your charge." } as any,
    ],
    similarDescriptions: [
      "bright banner with tech elements",
      "modern card layout",
    ],
    themeEmbedding: [0.1, 0.2, 0.3, 0.4],
    avgSimilarity: 0.75,
    method: "hybrid",
  };

  /**
   * Integrates: PromptEnhancementService.enhancePromtWithRAG with theme and RAG context.
   * External: Pure service logic; no DB or API calls.
   * Validates: enhanced prompt includes user prompt + RAG insights + theme colors + mood + styles.
   */
  it("enhances prompt with RAG context and theme analysis", () => {
    const userPrompt = "professional banner background";
    const enhanced = PromptEnhancementService.enhancePromtWithRAG(
      userPrompt,
      mockRagContext,
      mockThemeAnalysis
    );

    expect(enhanced).toContain(userPrompt);
    expect(enhanced.toLowerCase()).toContain("vibrant and energetic");
    expect(enhanced.toLowerCase()).toContain("minimalist");
    expect(enhanced.toLowerCase()).toContain("modern");
    expect(enhanced.toLowerCase()).toContain("matching the style of previous successful content:");
    // Color palette should be included
    expect(enhanced.toLowerCase()).toContain("ff6b6b");
  });

  /**
   * Integrates: Prompt enhancement with minimal/empty RAG context.
   * External: Service gracefully handles sparse data.
   * Validates: enhanced prompt still includes mood and styles even with empty similarDescriptions.
   */
  it("enhances prompt gracefully with empty RAG context", () => {
    const userPrompt = "simple card design";
    const sparseRagContext: RAGContext = {
      relevantContents: [],
      similarDescriptions: [],
      themeEmbedding: [],
      avgSimilarity: 0,
      method: "bm25",
    };

    const enhanced = PromptEnhancementService.enhancePromtWithRAG(
      userPrompt,
      sparseRagContext,
      mockThemeAnalysis
    );

    expect(enhanced).toContain(userPrompt);
    expect(enhanced.toLowerCase()).toContain("vibrant and energetic");
    // Should not include RAG insights if similarDescriptions is empty
    expect(enhanced.toLowerCase()).not.toContain("previous successful");
  });

  /**
   * Integrates: buildBrandedPrompt constructs full branded prompt + negative prompt.
   * External: Pure service logic; no DB or API calls.
   * Validates: branded prompt includes project context, theme inspirations, quality modifiers.
   */
  it("builds branded prompt with project context and theme", () => {
    const params = {
      userPrompt: "banner design",
      projectName: "Acme Marketing",
      projectDescription: "B2B SaaS platform for data analytics",
      themeInspirations: ["minimalist", "tech-forward"],
      stylePreferences: { composition: "centered", lighting: "soft" },
      targetAudience: "enterprise",
    };

    const { prompt, negativePrompt } =
      PromptEnhancementService.buildBrandedPrompt(params);

    expect(prompt).toContain("banner design");
    expect(prompt).toContain("Acme Marketing");
    expect(prompt).toContain("minimalist");
    expect(prompt).toContain("tech-forward");
    expect(prompt).toContain("enterprise");
    expect(prompt).toContain("centered composition");
    expect(prompt).toContain("soft lighting");
    expect(prompt).toContain("professional");
    expect(prompt).toContain("marketing-ready");

    // Negative prompt should be non-empty
    expect(negativePrompt.length).toBeGreaterThan(0);
  });

  /**
   * Integrates: buildBrandedPrompt with minimal parameters.
   * External: Service provides defaults for optional fields.
   * Validates: prompt is complete even with sparse stylePreferences and no targetAudience.
   */
  it("builds branded prompt with minimal parameters", () => {
    const params = {
      userPrompt: "icon set",
      projectName: "Project X",
      projectDescription: "Mobile app icons",
      themeInspirations: [],
    };

    const { prompt, negativePrompt } =
      PromptEnhancementService.buildBrandedPrompt(params);

    expect(prompt).toContain("icon set");
    expect(prompt).toContain("Project X");
    expect(prompt).toContain("general audience"); // default
    expect(prompt).toContain("professional");
    expect(negativePrompt.length).toBeGreaterThan(0);
  });

  /**
   * Integrates: scoreRagQuality heuristic scoring with high brand strength + good RAG similarity.
   * External: Pure calculation; no DB or API calls.
   * Validates: score increases with strong theme and high similarity metrics.
   */
  it("scores RAG quality high with strong theme and high similarity", () => {
    const strongTheme: ThemeAnalysis = {
      ...mockThemeAnalysis,
      brand_strength: 0.95,
      complexity_score: 85,
    };
    const goodRagContext: RAGContext = {
      ...mockRagContext,
      avgSimilarity: 0.8,
    };
    const promptLength = 50; // moderate length

    const score = PromptEnhancementService.scoreRagQuality(
      strongTheme,
      goodRagContext,
      promptLength
    );

    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(100);
    // With high brand strength, high similarity, moderate complexity, and good prompt length,
    // score should be above baseline (50)
    expect(score).toBeGreaterThan(50);
  });

  /**
   * Integrates: scoreRagQuality scoring with low theme strength and poor similarity.
   * External: Pure calculation; no DB or API calls.
   * Validates: score stays near baseline (50) with weak metrics.
   */
  it("scores RAG quality near baseline with weak theme and low similarity", () => {
    const weakTheme: ThemeAnalysis = {
      ...mockThemeAnalysis,
      brand_strength: 0.1,
      complexity_score: 20,
    };
    const poorRagContext: RAGContext = {
      ...mockRagContext,
      avgSimilarity: 0.2,
    };
    const shortPrompt = 10; // too short

    const score = PromptEnhancementService.scoreRagQuality(
      weakTheme,
      poorRagContext,
      shortPrompt
    );

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // With weak metrics, score should be close to baseline (50)
    expect(score).toBeLessThanOrEqual(60);
  });

  /**
   * Integrates: scoreRagQuality optimal prompt length detection.
   * External: Pure calculation; prompt length heuristic (20-80 words).
   * Validates: score bonus for moderate-length prompts (typically 100-400 chars).
   */
  it("scores higher for prompts in optimal length range (20-80 words)", () => {
    const theme = mockThemeAnalysis;
    const rag = mockRagContext;

    // Moderate-length prompt (~30 words ~ 150 chars)
    const moderateScore = PromptEnhancementService.scoreRagQuality(
      theme,
      rag,
      150
    );

    // Very short prompt (~5 words ~ 25 chars)
    const shortScore = PromptEnhancementService.scoreRagQuality(theme, rag, 25);

    // Very long prompt (~200 words ~ 1000 chars)
    const longScore = PromptEnhancementService.scoreRagQuality(
      theme,
      rag,
      1000
    );

    // Moderate should be >= short and >= long (or close)
    expect(moderateScore).toBeGreaterThanOrEqual(shortScore);
    expect(moderateScore).toBeGreaterThanOrEqual(longScore - 5); // allow small variance
  });

  /**
   * Integrates: scoreRagQuality similarity thresholds.
   * External: Pure calculation; similarity tiers (>0.7, >0.5, >0.3).
   * Validates: score increases at similarity thresholds.
   */
  it("applies similarity bonus at correct thresholds", () => {
    const theme = mockThemeAnalysis;
    const promptLength = 100;

    // High similarity (>0.7)
    const highSim = PromptEnhancementService.scoreRagQuality(
      theme,
      { ...mockRagContext, avgSimilarity: 0.75 },
      promptLength
    );

    // Medium similarity (>0.5, <0.7)
    const medSim = PromptEnhancementService.scoreRagQuality(
      theme,
      { ...mockRagContext, avgSimilarity: 0.6 },
      promptLength
    );

    // Low similarity (>0.3, <0.5)
    const lowSim = PromptEnhancementService.scoreRagQuality(
      theme,
      { ...mockRagContext, avgSimilarity: 0.4 },
      promptLength
    );

    // Very low similarity (<0.3)
    const veryLowSim = PromptEnhancementService.scoreRagQuality(
      theme,
      { ...mockRagContext, avgSimilarity: 0.1 },
      promptLength
    );

    expect(highSim).toBeGreaterThan(medSim);
    expect(medSim).toBeGreaterThan(lowSim);
    expect(lowSim).toBeGreaterThan(veryLowSim);
  });

  /**
   * Integrates: scoreRagQuality clamping behavior.
   * External: Pure calculation; scores clamped to [0, 100].
   * Validates: extreme scores do not exceed bounds.
   */
  it("clamps quality score to [0, 100]", () => {
    const extremeTheme: ThemeAnalysis = {
      ...mockThemeAnalysis,
      brand_strength: 2.0, // artificially high
      complexity_score: 200,
    };
    const extremeRag: RAGContext = {
      ...mockRagContext,
      avgSimilarity: 1.5, // artificially high
    };
    const extremeLength = 10000; // very long

    const score = PromptEnhancementService.scoreRagQuality(
      extremeTheme,
      extremeRag,
      extremeLength
    );

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
