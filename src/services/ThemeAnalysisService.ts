/**
 * services/ThemeAnalysisService.ts
 *
 * Analyzes themes to extract colors, styles, and brand characteristics.
 */

import { Theme, ThemeAnalysis, ColorPalette } from "../types";
import logger from "../config/logger";
import { colorKeywords, colorMap, styleKeywords } from "../config/keywords";

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
      .filter((a) => a[1] > 0) // filter by score > 0
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
    logger.info(`ThemeAnalysisService: Extracting color palette`);

    const tokens = [...theme.tags, ...theme.inspirations, theme.name]
      .join(" ")
      .toLowerCase();

    const { explicit, adjectives, combined } = this.getColors(tokens);
    const { primary, secondary, accent } = this.assignPalette(
      explicit,
      adjectives,
      combined
    );

    const palette: ColorPalette = {
      primary,
      secondary,
      accent,
      mood: "neutral",
    };

    // Mood inference
    const warmColors = ["red", "orange", "yellow"];
    const coolColors = ["blue", "green", "purple", "teal"];
    const energeticKeywords = ["playful", "vibrant", "bright", "dynamic"];
    const calmKeywords = ["calm", "serene", "soft", "gentle"];
    const professionalKeywords = ["professional", "corporate"];

    const allColors = [
      ...palette.primary,
      ...palette.secondary,
      ...palette.accent,
    ];

    if (allColors.some((c) => warmColors.includes(c))) {
      palette.mood = "energetic";
    } else if (allColors.some((c) => coolColors.includes(c))) {
      palette.mood = "calm";
    }
    if (energeticKeywords.some((k) => tokens.includes(k)))
      palette.mood = "energetic";
    if (calmKeywords.some((k) => tokens.includes(k))) palette.mood = "calm";
    if (professionalKeywords.some((k) => tokens.includes(k)))
      palette.mood = "professional";

    logger.info(`ThemeAnalysisService: Extracted color palette: ${palette}`);
    return palette;
  }

  /**
   * Detect explicit color mentions and adjective-derived color suggestions
   * from a token string.
   *
   * - explicit: colors mapped from explicit keywords (via `colorMap`).
   * - adjectives: colors implied by descriptive words (e.g. "vibrant" -> pink, yellow).
   * - combined: union of explicit + adjective colors with fallback rules
   *   when no direct matches are found.
   *
   * @param tokens - Lowercased combined tokens from theme fields.
   * @returns An object containing `explicit`, `adjectives`, and `combined` color arrays.
   */
  private static getColors(tokens: string): {
    explicit: string[];
    adjectives: string[];
    combined: string[];
  } {
    // Explicit color detection
    const explicit = [
      ...new Set(
        Object.keys(colorMap)
          .sort((a, b) => b.length - a.length)
          .filter((key) => tokens.includes(key))
          .map((key) => colorMap[key])
      ),
    ];

    // Adjective colors
    const adjectiveMap: Record<string, string[]> = {
      colorful: ["red", "blue", "yellow", "green", "orange"],
      vibrant: ["pink", "yellow", "blue"],
      bright: ["yellow", "orange", "pink"],
      playful: ["pink", "yellow", "blue"],
      fun: ["pink", "yellow", "blue"],
      warm: ["red", "orange", "yellow"],
      cool: ["blue", "green", "purple"],
      pastel: ["pink", "beige", "lavender"],
      neon: ["pink", "green", "blue"],
    };

    const adjectives = [
      ...new Set(
        Object.entries(adjectiveMap)
          .filter(([word]) => tokens.includes(word))
          .flatMap(([, colors]) => colors)
      ),
    ];

    let combined = [...explicit, ...adjectives];

    // Fallback if no colors detected
    if (combined.length === 0) {
      if (
        tokens.includes("playful") ||
        tokens.includes("fun") ||
        tokens.includes("friendly")
      )
        combined = ["pink", "yellow", "blue"];
      else if (tokens.includes("professional") || tokens.includes("corporate"))
        combined = ["blue", "gray", "white"];
      else if (tokens.includes("modern") || tokens.includes("minimal"))
        combined = ["white", "black", "gray"];
      else combined = ["purple", "white", "blue"];
    }

    combined = [...new Set(combined)];

    return { explicit, adjectives, combined };
  }

  /**
   * Assign colors into primary, secondary and accent buckets using a
   * lightweight weighted strategy.
   *
   * Weights:
   * - explicit mentions => weight 3
   * - adjective-derived => weight 2
   * - fallback combined => weight 1 (used only when explicit/adjective lists are empty)
   *
   * The method deduplicates colors, keeps the highest weight per color,
   * sorts by weight and returns the top colors for each bucket.
   *
   * @param explicit - Explicitly detected colors.
   * @param adjectives - Colors suggested by adjectives.
   * @param combined - Combined/fallback color candidates.
   * @returns An object with `primary`, `secondary`, and `accent` arrays.
   */
  private static assignPalette(
    explicit: string[],
    adjectives: string[],
    combined: string[]
  ) {
    const weighted: { color: string; weight: number }[] = [];

    explicit.forEach((c) => weighted.push({ color: c, weight: 3 }));
    adjectives.forEach((c) => weighted.push({ color: c, weight: 2 }));

    if (explicit.length === 0 && adjectives.length === 0)
      combined.forEach((c) => weighted.push({ color: c, weight: 1 }));

    const map = new Map<string, number>();
    weighted.forEach(({ color, weight }) => {
      map.set(color, Math.max(weight, map.get(color) || 0));
    });

    const sorted = [...map.entries()]
      .map(([color, weight]) => ({ color, weight }))
      .sort((a, b) => b.weight - a.weight);

    const primary = sorted.slice(0, 2).map((x) => x.color);
    const secondary = sorted.slice(2, 4).map((x) => x.color);
    const accent = sorted.slice(4, 7).map((x) => x.color);

    return { primary, secondary, accent };
  }

  /**
   * Score style relevance for known style categories.
   *
   * @param theme - Theme object containing `name`, `tags`, and `inspirations`.
   * @returns A record mapping style names to numeric scores (0-100).
   */
  private static calculateStyleScores(theme: Theme): Record<string, number> {
    logger.info(
      `ThemeAnalysisService: Calculating style scores: ${theme.name}`
    );

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

    logger.info(`ThemeAnalysisService: Calculated style scores: ${scores}`);
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
    logger.info(`ThemeAnalysisService: Anaylising visual mood: ${theme.name}`);
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

    logger.info(`ThemeAnalysisService: Dominant visual mood: ${dominantMood}`);
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
    logger.info(
      `ThemeAnalysisService: Calculating complexity scores: ${theme.name}`
    );
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
    const result = Math.max(0, Math.min(100, score));
    logger.info(`ThemeAnalysisService: Calculated style score: ${result}`);

    return result;
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
    logger.info(
      `ThemeAnalysisService: Calculated brand strength: ${theme.name}`
    );
    // 1) Sanitize tags (remove junk)
    const cleanedTags = theme.tags
      .filter((t) => typeof t === "string")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length < 40) // too long = junk
      .filter((t) => /^[a-z0-9\-_\s]+$/i.test(t)); // remove special chars, SQL, symbols

    // 2) Sanitize inspirations
    const cleanedInsp = theme.inspirations
      .filter((i) => typeof i === "string")
      .map((i) => i.trim().toLowerCase())
      .filter((i) => i.length > 0);

    const tokens = [
      ...cleanedTags,
      ...cleanedInsp,
      theme.name.toLowerCase(),
    ].join(" ");

    let score = 20; // lower baseline for accuracy

    // TAG QUALITY (not just quantity)
    const meaningfulTags = cleanedTags.filter(
      (tag) => !/^\d+$/.test(tag) && tag.length > 2
    );

    if (meaningfulTags.length >= 5) score += 25;
    else if (meaningfulTags.length >= 3) score += 15;

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

    // STYLE SIGNALS (modern, playful, elegant)
    if (styleKeywords.some((s) => tokens.includes(s))) score += 10;

    // Negative scoring for REALLY junk input (SQL injection / special chars)
    const hasJunk =
      theme.tags.some((t) => typeof t === "string" && /['";<>]/.test(t)) ||
      theme.inspirations.some(
        (i) => typeof i === "string" && /['";<>]/.test(i)
      );

    if (hasJunk) score -= 15;

    // Clamp final score to [0,100]
    const result = Math.max(0, Math.min(100, score));
    logger.info(`ThemeAnalysisService: Calculated brand strength: ${result}`);

    return result;
  }
}
