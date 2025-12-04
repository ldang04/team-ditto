// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// Client Types
export interface Client {
  id?: string;
  name: string;
}

export interface ClientCreateResponse {
  client_id: string;
  api_key: string;
}

// Project Types
export interface Project {
  id?: string;
  theme_id?: string;
  client_id?: string;
  name: string;
  description?: string;
  goals?: string;
  customer_type?: string;
  created_at?: string;
}

// Theme Types
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

export interface Theme {
  id?: string;
  name: string;
  font?: string;
  tags?: string[];
  inspirations?: string[];
  analysis?: ThemeAnalysis;
  client_id?: string;
  created_at?: string;
}

// Content Types
export interface Content {
  id?: string;
  project_id: string;
  media_type: string;
  media_url: string;
  text_content: string;
  prompt?: string;
  enhanced_prompt?: string;
  created_at?: string;
}

// Generation Types
export interface TextGenerationRequest {
  project_id: string;
  prompt: string;
  style_preferences?: Record<string, any>;
  target_audience?: string;
  variantCount?: number;
}

export interface TextGenerationVariant {
  content_id: string;
  generated_content: string;
}

export interface TextGenerationResponse {
  variants: TextGenerationVariant[];
  project_id: string;
  media_type: string;
  variant_count: number;
  timestamp: string;
}

export interface InputImage {
  data: string; // Base64 encoded image
  mimeType: string;
}

export interface ImageGenerationRequest {
  project_id: string;
  prompt: string;
  style_preferences?: Record<string, any>;
  target_audience?: string;
  variantCount?: number;
  aspectRatio?: string;
  input_images?: InputImage[]; // Optional input images for multimodal generation
  overlay_text?: string; // Optional text to render in the generated image
}

export interface ImageGenerationVariant {
  content_id: string;
  image_url: string;
  prompt: string;
  enhancedPrompt: string;
  seed?: number;
}

export interface ComputationMetrics {
  rag_similarity: number;
  theme_analysis: ThemeAnalysis;
  prompt_quality: number;
  predicted_quality: number;
  rag_context_items: number;
}

export interface ImageGenerationResponse {
  variants: ImageGenerationVariant[];
  project_id: string;
  media_type: string;
  variant_count: number;
  computation_metrics: ComputationMetrics;
  timestamp: string;
}

// Validation Types
export interface ValidationRequest {
  content_id?: string;
  content?: string;
  project_id?: string;
  media_type?: string;
  image_base64?: string;
}

export interface ValidationIssue {
  severity: 'major' | 'minor';
  category: string;
  description: string;
  suggestion: string;
}

export interface ValidationResult {
  brand_consistency_score: number;
  quality_score: number;
  overall_score: number;
  passes_validation: boolean;
  strengths: string[];
  issues: ValidationIssue[];
  recommendations: string[];
  summary: string;
}

export interface ValidationResponse {
  content_id?: string;
  project_id: string;
  validation: ValidationResult;
  timestamp: string;
}

