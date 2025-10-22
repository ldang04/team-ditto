import { Request, Response } from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { ContentModel } from "../models/ContentModel";
import { ProjectModel } from "../models/ProjectModel";
import { ThemeModel } from "../models/ThemeModel";
import { EmbeddingsModel } from "../models/EmbeddingsModel";
import "dotenv/config";

export const ComputationController = {
  async generate(req: Request, res: Response) {
    try {
      const { 
        project_id, 
        prompt, 
        media_type = "text", // default
        style_preferences = {},
        target_audience = "general",
        variantCount = 3
      } = req.body;

      if (!project_id || !prompt) {
        return res.status(400).json({ 
          error: "Missing required fields: project_id and prompt" 
        });
      }

      // Fetch project data for brand memory
      const { data: project, error: projectError } = await ProjectModel.getById(project_id);
      if (projectError || !project) {
        return res.status(404).json({ 
          error: "Project not found" 
        });
      }

      // Fetch theme data for brand memory
      const { data: theme, error: themeError } = await ThemeModel.getById(project.theme_id);
      if (themeError || !theme) {
        return res.status(404).json({ 
          error: "Theme not found" 
        });
      }

      // Initialize Vertex AI
      const vertex = new VertexAI({ 
        project: process.env.GCP_PROJECT_ID,
        location: "us-central1"
      });
      
      const model = vertex.getGenerativeModel({
        model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
      });

      // Build context-aware prompt with brand memory
      // CITATION: used AI to generate prompt for content generation
      const enhancedPrompt = `
        Generate ${variantCount} different variants of ${media_type} content for a marketing campaign with the following requirements:
        
        PROJECT CONTEXT:
        - Project Name: ${project.name}
        - Description: ${project.description}
        - Goals: ${project.goals}
        - Customer Type: ${project.customer_type}
        
        THEME & BRAND:
        - Theme Name: ${theme.name}
        - Font: ${theme.font}
        - Tags: ${theme.tags.join(', ')}
        - Inspirations: ${theme.inspirations.join(', ')}
        
        GENERATION REQUIREMENTS:
        - User Prompt: ${prompt}
        - Media Type: ${media_type}
        - Target Audience: ${target_audience}
        - Style Preferences: ${JSON.stringify(style_preferences)}
        
        Create ${variantCount} distinct, branded content variants that align with the project's theme and goals.
        Each variant should be clearly separated with "---VARIANT_START---" and "---VARIANT_END---" markers.
        Return the content in a format suitable for ${media_type} generation.
      `;

      const result = await model.generateContent({
        contents: [{ 
          role: "user", 
          parts: [{ text: enhancedPrompt }] 
        }],
      });

      const generatedText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated";
      
      // parse variants from the response - use regex to separate content.
      const variantRegex = /---VARIANT_START---(.*?)---VARIANT_END---/gs;
      const matches = generatedText.match(variantRegex);
      
      let variants = [];
      if (matches && matches.length > 0) {
        // extract content from each variant
        variants = matches.map(match => 
          match.replace(/---VARIANT_START---/g, '').replace(/---VARIANT_END---/g, '').trim()
        );
      } else {
        // fallback: split by common separators or use the whole text
        const fallbackVariants = generatedText.split('\n\n').filter(v => v.trim().length > 0);
        variants = fallbackVariants.length > 0 ? fallbackVariants : [generatedText];
      }

      // ensure we don't exceed the requested variant count
      variants = variants.slice(0, variantCount);

      // save each variant to database and generate embeddings
      const savedVariants = [];
      for (const variantContent of variants) {
        const { data, error } = await ContentModel.create({
          project_id,
          media_type,
          media_url: "", // TODO: add media url when file storage is implemented
          text_content: variantContent,
        });
        
        if (error) {
          console.error("Database save error:", error);
          continue; // if a particular variant fails, continue with others
        }

        // generate and store embeddings
        await ComputationController.generateEmbedding(data.id, variantContent);

        savedVariants.push({
          content_id: data.id,
          generated_content: variantContent
        });
      }

      if (savedVariants.length === 0) {
        return res.status(500).json({ 
          error: "Failed to save any content variants to database"
        });
      }
      
      res.json({
        success: true,
        variants: savedVariants,
        project_id,
        media_type,
        variant_count: savedVariants.length,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error("Generate error:", error);
      res.status(500).json({ 
        error: "Content generation failed", 
        details: error.message || "Unknown error"
      });
    }
  },

  async generateEmbedding(contentId: string, text: string): Promise<void> {
    try {
      console.log(`Would generate embedding for content ${contentId}: ${text.substring(0, 100)}...`);
      
      await EmbeddingsModel.create({
        content_id: contentId,
        embedding: [], // Empty array for now
        text_content: text
      });

    } catch (error) {
      console.warn("Failed to generate/store embedding:", error);
    }
  }
};
