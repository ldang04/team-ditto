/**
 * services/ThemeAnalysisService.ts
 *
 * Analyzes themes to extract colors, styles, and brand characteristics.
 */

import { Theme, ThemeAnalysis, ColorPalette } from "../types";
import logger from "../config/logger";
import { colorKeywords, styleKeywords } from "../config/keywords";

export class ThemeAnalysisService {
  /**
   * Perform a theme analysis and return aggregated metrics.
   *
   * @param theme - Theme to analyze (expects `name`, `tags`, `inspirations`).
   * @returns A `ThemeAnalysis` object containing the derived metrics.
   */
  static analyzeTheme(theme: Theme): ThemeAnalysis {
    logger.info(`ThemeAnalysisService: Analyzing theme "${theme.name}"`);

    // 1) Extract a color palette and simple mood from theme tokens
    const colorPalette = this.extractColorPalette(theme);

    // 2) Score known style categories and pick the top 3
    const styleScores = this.calculateStyleScores(theme);
    const dominantStyles = Object.entries(styleScores)
      .sort((a, b) => b[1] - a[1]) // sort descending by score
      .slice(0, 3) // keep top 3 styles
      .map(([style]) => style);

    // 3) Determine single-word visual mood (energetic, calm, etc.)
    const visualMood = this.determineVisualMood(theme);

    // 4) Compute complexity and brand-strength heuristics
    const complexityScore = this.calculateComplexityScore(theme);
    const brandStrength = this.calculateBrandStrength(theme);

    // 5) Aggregate a single styleScore for easy ranking: weighted sum
    //    - prefer explicit style matches, but include complexity & brand
    const styleScore = Math.round(
      (styleScores[dominantStyles[0]] || 0) * 0.4 +
        complexityScore * 0.3 +
        brandStrength * 0.3
    );

    // 6) Return the assembled ThemeAnalysis payload
    return {
      color_palette: colorPalette,
      style_score: styleScore,
      dominant_styles: dominantStyles,
      visual_mood: visualMood,
      complexity_score: complexityScore,
      brand_strength: brandStrength,
    };
  }

  /**
   * Extract a color palette and mood from a Theme.
   *
   * @param theme - Theme object containing `name`, `tags`, and `inspirations`.
   * @returns A `ColorPalette` with `primary`, `secondary`, `accent` arrays and a `mood`.
   */
  private static extractColorPalette(theme: Theme): ColorPalette {
    const allTokens = [...theme.tags, ...theme.inspirations, theme.name].join(
      " "
    );
    const lowerTokens = allTokens.toLowerCase();

    const colorMapping: Record<
      string,
      { category: "primary" | "secondary" | "accent"; color: string }
    > = {
      red: { category: "primary", color: "red" },
      blue: { category: "primary", color: "blue" },
      green: { category: "secondary", color: "green" },
      yellow: { category: "accent", color: "yellow" },
      orange: { category: "accent", color: "orange" },
      purple: { category: "secondary", color: "purple" },
      pink: { category: "secondary", color: "pink" },
      black: { category: "primary", color: "black" },
      white: { category: "primary", color: "white" },
      gray: { category: "secondary", color: "gray" },
      grey: { category: "secondary", color: "gray" },
      gold: { category: "accent", color: "gold" },
      silver: { category: "accent", color: "silver" },
    };

    // Initialize empty buckets
    const palette: ColorPalette = {
      primary: [],
      secondary: [],
      accent: [],
      mood: "neutral",
    };

    // Extract explicit color mentions by scanning tokens
    Object.entries(colorMapping).forEach(([keyword, config]) => {
      if (lowerTokens.includes(keyword)) {
        palette[config.category].push(config.color);
      }
    });

    // If no explicit colors were found, infer defaults from keywords
    // (e.g. 'corporate' -> blue/gray, 'modern' -> white/black)
    if (
      palette.primary.length === 0 &&
      palette.secondary.length === 0 &&
      palette.accent.length === 0
    ) {
      if (
        lowerTokens.includes("corporate") ||
        lowerTokens.includes("professional")
      ) {
        palette.primary = ["blue", "gray"];
        palette.accent = ["white"];
      } else if (lowerTokens.includes("modern")) {
        palette.primary = ["white", "black"];
        palette.secondary = ["gray"];
      } else {
        // Generic fallback palette
        palette.primary = ["blue"];
        palette.secondary = ["gray", "white"];
      }
    }

    // Derive a simple mood label from the discovered colors:
    // energetic (warm accents) | professional (blue primary) | balanced (fallback)
    if (palette.accent.some((c) => ["red", "orange", "yellow"].includes(c))) {
      palette.mood = "energetic";
    } else if (palette.primary.includes("blue")) {
      palette.mood = "professional";
    } else {
      palette.mood = "balanced";
    }

    return palette;
  }

  /**
   * Score style relevance for known style categories.
   *
   * @param theme - Theme object containing `name`, `tags`, and `inspirations`.
   * @returns A record mapping style names to numeric scores (0-100).
   */
  private static calculateStyleScores(theme: Theme): Record<string, number> {
    // Combine all theme tokens into a single lowercased string
    const allTokens = [...theme.tags, ...theme.inspirations, theme.name].join(
      " "
    );
    const lowerTokens = allTokens.toLowerCase();

    // Keyword lists for each style category. Presence of a keyword
    // contributes a fixed increment to that style's score.
    const styleKeywords: Record<string, string[]> = {
      modern: ["modern", "contemporary", "sleek", "clean", "minimalist"],
      vintage: ["vintage", "retro", "classic", "nostalgic"],
      elegant: ["elegant", "sophisticated", "refined", "luxurious"],
      bold: ["bold", "striking", "dramatic", "powerful"],
      playful: ["playful", "fun", "whimsical", "creative"],
      professional: ["professional", "corporate", "business", "formal"],
      artistic: ["artistic", "creative", "expressive", "unique"],
      minimalist: ["minimalist", "simple", "clean", "sparse"],
    };

    const scores: Record<string, number> = {};

    // For each style, count matching keywords and accumulate a score.
    // Each match increments by 20 and results are clamped to 100.
    Object.entries(styleKeywords).forEach(([style, keywords]) => {
      let score = 0;
      keywords.forEach((keyword) => {
        if (lowerTokens.includes(keyword)) {
          score += 20; // fixed increment per keyword match
        }
      });
      scores[style] = Math.min(score, 100);
    });

    // Return the mapping of style -> score for downstream use
    return scores;
  }

  /**
   * Determine the visual mood of a theme.
   *
   * @param theme - Theme object with `name`, `tags`, and `inspirations`.
   * @returns A short mood string (e.g. 'energetic', 'calm', 'professional').
   */
  private static determineVisualMood(theme: Theme): string {
    // Aggregate all theme tokens into one lowercased string for matching
    const allTokens = [...theme.tags, ...theme.inspirations, theme.name].join(
      " "
    );
    const lowerTokens = allTokens.toLowerCase();

    // Mood keywords grouped by mood label. Count matches per group.
    const moodKeywords: Record<string, string[]> = {
      energetic: ["energetic", "dynamic", "vibrant", "exciting"],
      calm: ["calm", "serene", "peaceful", "tranquil"],
      professional: ["professional", "serious", "formal", "trustworthy"],
      friendly: ["friendly", "approachable", "warm", "welcoming"],
      luxurious: ["luxurious", "premium", "elegant", "sophisticated"],
      innovative: ["innovative", "cutting-edge", "futuristic", "tech"],
    };

    // Track highest-scoring mood; default to 'balanced' when none match.
    let maxScore = 0;
    let dominantMood = "balanced";

    // For each mood, count how many of its keywords appear in the theme.
    Object.entries(moodKeywords).forEach(([mood, keywords]) => {
      const score = keywords.filter((k) => lowerTokens.includes(k)).length;
      // Select mood with the highest match count
      if (score > maxScore) {
        maxScore = score;
        dominantMood = mood;
      }
    });

    return dominantMood;
  }

  /**
   * Compute a simple complexity score for a Theme.
   *
   * Signals used:
   * - Number of tags (more tags -> higher complexity)
   * - Number of inspirations (adds nuance)
   * - Number of words in the theme name (longer names imply complexity)
   * - Presence of multiple style keywords (indicates stylistic richness)
   *
   * @param theme - Theme object to evaluate.
   * @returns Numeric complexity score between 0 and 100.
   */
  private static calculateComplexityScore(theme: Theme): number {
    let score = 50; // baseline

    // Tags: each tag adds up to 5 points, capped at +20
    score += Math.min(theme.tags.length * 5, 20);

    // Inspirations: each adds up to 5 points, capped at +15
    score += Math.min(theme.inspirations.length * 5, 15);

    // Longer theme names suggest richer / more complex concepts
    const nameWords = theme.name.split(/\s+/).length;
    if (nameWords > 2) score += 10;

    // Count presence of style keywords to estimate stylistic richness
    const allTokens = [...theme.tags, ...theme.inspirations, theme.name].join(
      " "
    );
    const styleCount = styleKeywords.filter((s) =>
      allTokens.toLowerCase().includes(s)
    ).length;

    if (styleCount > 2) score += 15; // boost when many style keywords found

    // Clamp final score to [0,100]
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compute a lightweight brand strength score.
   *
   * Signals used:
   * - Tag count (more tags implies broader brand scope)
   * - Inspirations count (more inspirations indicates richer references)
   * - Multi-word name (suggests a descriptive brand name)
   * - Presence of explicit color words (indicates visual identity)
   *
   * @param theme - Theme object to evaluate.
   * @returns Numeric brand strength score between 0 and 100.
   */
  private static calculateBrandStrength(theme: Theme): number {
    let score = 30; // baseline

    // Tags: reward more tags (up to +25)
    if (theme.tags.length >= 5) score += 25;
    else if (theme.tags.length >= 3) score += 15;

    // Inspirations: reward more inspiration sources (up to +20)
    if (theme.inspirations.length >= 3) score += 20;
    else if (theme.inspirations.length >= 1) score += 10;

    // Multi-word names often indicate a richer brand descriptor
    if (theme.name.split(/\s+/).length > 1) score += 15;

    // If the theme mentions color words, treat that as a sign of visual identity
    const allTokens = [...theme.tags, ...theme.inspirations, theme.name].join(
      " "
    );
    const hasColors = colorKeywords.some((c) =>
      allTokens.toLowerCase().includes(c)
    );
    if (hasColors) score += 10;

    // Clamp to [0,100]
    return Math.max(0, Math.min(100, score));
  }
}
