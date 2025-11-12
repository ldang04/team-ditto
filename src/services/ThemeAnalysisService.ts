/**
 * services/ThemeAnalysisService.ts
 * 
 * Analyzes themes to extract colors, styles, and brand characteristics.
 */

import { Theme } from "../types";
import logger from "../config/logger";

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
  mood: string;
}

export interface ThemeAnalysis {
  colorPalette: ColorPalette;
  styleScore: number;
  dominantStyles: string[];
  visualMood: string;
  complexityScore: number;
  brandStrength: number;
}

export class ThemeAnalysisService {
  /**
   * Analyze theme and extract comprehensive brand characteristics
   */
  static analyzeTheme(theme: Theme): ThemeAnalysis {
    logger.info(`ThemeAnalysisService: Analyzing theme "${theme.name}"`);

    const colorPalette = this.extractColorPalette(theme);
    const styleScores = this.calculateStyleScores(theme);
    const dominantStyles = Object.entries(styleScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);

    const visualMood = this.determineVisualMood(theme);
    const complexityScore = this.calculateComplexityScore(theme);
    const brandStrength = this.calculateBrandStrength(theme);

    const styleScore = Math.round(
      (styleScores[dominantStyles[0]] || 0) * 0.4 +
        complexityScore * 0.3 +
        brandStrength * 0.3
    );

    return {
      colorPalette,
      styleScore,
      dominantStyles,
      visualMood,
      complexityScore,
      brandStrength,
    };
  }

  private static extractColorPalette(theme: Theme): ColorPalette {
    const allTokens = [
      ...theme.tags,
      ...theme.inspirations,
      theme.name,
    ].join(" ");
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

    const palette: ColorPalette = {
      primary: [],
      secondary: [],
      accent: [],
      mood: "neutral",
    };

    // Extract colors
    Object.entries(colorMapping).forEach(([keyword, config]) => {
      if (lowerTokens.includes(keyword)) {
        palette[config.category].push(config.color);
      }
    });

    // Infer colors if none found
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
        palette.primary = ["blue"];
        palette.secondary = ["gray", "white"];
      }
    }

    // Determine mood from colors
    if (palette.accent.some((c) => ["red", "orange", "yellow"].includes(c))) {
      palette.mood = "energetic";
    } else if (palette.primary.includes("blue")) {
      palette.mood = "professional";
    } else {
      palette.mood = "balanced";
    }

    return palette;
  }

  private static calculateStyleScores(theme: Theme): Record<string, number> {
    const allTokens = [
      ...theme.tags,
      ...theme.inspirations,
      theme.name,
    ].join(" ");
    const lowerTokens = allTokens.toLowerCase();

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

    Object.entries(styleKeywords).forEach(([style, keywords]) => {
      let score = 0;
      keywords.forEach((keyword) => {
        if (lowerTokens.includes(keyword)) {
          score += 20;
        }
      });
      scores[style] = Math.min(score, 100);
    });

    return scores;
  }

  private static determineVisualMood(theme: Theme): string {
    const allTokens = [
      ...theme.tags,
      ...theme.inspirations,
      theme.name,
    ].join(" ");
    const lowerTokens = allTokens.toLowerCase();

    const moodKeywords: Record<string, string[]> = {
      energetic: ["energetic", "dynamic", "vibrant", "exciting"],
      calm: ["calm", "serene", "peaceful", "tranquil"],
      professional: ["professional", "serious", "formal", "trustworthy"],
      friendly: ["friendly", "approachable", "warm", "welcoming"],
      luxurious: ["luxurious", "premium", "elegant", "sophisticated"],
      innovative: ["innovative", "cutting-edge", "futuristic", "tech"],
    };

    let maxScore = 0;
    let dominantMood = "balanced";

    Object.entries(moodKeywords).forEach(([mood, keywords]) => {
      const score = keywords.filter((k) => lowerTokens.includes(k)).length;
      if (score > maxScore) {
        maxScore = score;
        dominantMood = mood;
      }
    });

    return dominantMood;
  }

  private static calculateComplexityScore(theme: Theme): number {
    let score = 50;

    score += Math.min(theme.tags.length * 5, 20);
    score += Math.min(theme.inspirations.length * 5, 15);

    const nameWords = theme.name.split(/\s+/).length;
    if (nameWords > 2) score += 10;

    const allTokens = [
      ...theme.tags,
      ...theme.inspirations,
      theme.name,
    ].join(" ");
    const styleCount = ["modern", "vintage", "elegant", "bold", "minimalist"]
      .filter((s) => allTokens.toLowerCase().includes(s)).length;

    if (styleCount > 2) score += 15;

    return Math.max(0, Math.min(100, score));
  }

  private static calculateBrandStrength(theme: Theme): number {
    let score = 30;

    if (theme.tags.length >= 5) score += 25;
    else if (theme.tags.length >= 3) score += 15;

    if (theme.inspirations.length >= 3) score += 20;
    else if (theme.inspirations.length >= 1) score += 10;

    if (theme.name.split(/\s+/).length > 1) score += 15;

    const allTokens = [
      ...theme.tags,
      ...theme.inspirations,
      theme.name,
    ].join(" ");
    const colorWords = ["red", "blue", "green", "yellow", "black", "white"];
    const hasColors = colorWords.some((c) =>
      allTokens.toLowerCase().includes(c)
    );
    if (hasColors) score += 10;

    return Math.max(0, Math.min(100, score));
  }
}

