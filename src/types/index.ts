export type Client = {
  id?: string;
  name: string;
};

export type ApiKey = {
  id?: string;
  client_id?: string;
  prefix: string;
  hashed_key: string;
  name?: string;
  active?: boolean;
  last_used_at?: Date;
};

export type Content = {
  id?: string;
  prompt: string;
  project_id: string;
  media_type: string;
  media_url: string;
  text_content: string;
  enhanced_prompt?: string;
};

export type Project = {
  id?: string;
  theme_id: string;
  client_id: string;
  name: string;
  description: string;
  goals: string;
  customer_type: string;
};

export type Theme = {
  id?: string;
  name: string;
  font: string;
  tags: string[];
  inspirations: string[];
  analysis?: ThemeAnalysis;
};

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
  mood: string;
}

export interface ThemeAnalysis {
  color_palette: ColorPalette;
  style_score: number;
  dominant_styles: string[];
  visual_mood: string;
  complexity_score: number;
  brand_strength: number;
}

export type Embedding = {
  id?: string;
  content_id: string;
  embedding: number[];
  text_content: string;
  media_type: string;
  created_at?: string;
};
