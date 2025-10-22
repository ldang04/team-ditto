/**
 * routes/computationRoutes.ts
 *
 * This file defines the Express routes for ...
 * All routes are protected via API key middleware, ensuring multi-tenant isolation.
 *
 */
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { VertexAI } from "@google-cloud/vertexai";
import { ContentModel } from "../models/ContentModel";
import "dotenv/config";

const router = Router();
router.use(authMiddleware); 

/**
 * CITATION: JSDoc generated using AI. 
 * Generates content using Vertex AI based on provided parameters
 * 
 * @route POST /api/generate
 * @param {Object} req.body.project_id - The ID of the project
 * @param {string} req.body.prompt - The user's content generation prompt
 * @param {string} [req.body.media_type=text] - Type of media to generate (e.g. text, image)
 * @param {Object} [req.body.style_preferences={}] - Style preferences for content generation
 * @param {string} [req.body.target_audience=general] - Target audience for the content
 * @returns {Object} Response containing the generated content
 * @throws {400} If project_id or prompt is missing
 * @throws {500} If content generation fails
 */
router.post("/generate", async (req, res) => {
  try {
    const { 
      project_id, 
      prompt, 
      media_type = "text", // default
      style_preferences = {},
      target_audience = "general"
    } = req.body;

    if (!project_id || !prompt) {
      return res.status(400).json({ 
        error: "Missing required fields: project_id and prompt" 
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
      Generate ${media_type} content for a marketing campaign with the following requirements:
      
      Project Context: ${project_id}
      User Prompt: ${prompt}
      Media Type: ${media_type}
      Target Audience: ${target_audience}
      Style Preferences: ${JSON.stringify(style_preferences)}
      
      Create branded, consistent content that aligns with the project's theme and goals.
      Return the content in a format suitable for ${media_type} generation.
    `;

    const result = await model.generateContent({
      contents: [{ 
        role: "user", 
        parts: [{ text: enhancedPrompt }] 
      }],
    });

    const generatedContent = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated";
    
    // Save generated content to database
    const { data, error } = await ContentModel.create({
      project_id,
      media_type,
      media_url: "", // TODO: add media url when file storage is implemented
      text_content: generatedContent,
    });
    
    if (error) {
      console.error("Database save error:", error);
      return res.status(500).json({ 
        error: "Failed to save content to database",
        details: error.message 
      });
    }
    
    res.json({
      success: true,
      content_id: data.id,
      project_id,
      media_type,
      generated_content: generatedContent,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Generate error:", error);
    res.status(500).json({ 
      error: "Content generation failed", 
      details: error.message || "Unknown error"
    });
  }
});

// GET /api/validate
// Returns
//
router.post("/validate", async (req, res) => {
    // TODO: Apply brand consistency checks
    // TODO: Score content quality
    // TODO: Suggest improvements

  res.json({ message: "validate endpoint not implemented yet" });
});

// GET /api/rank
// Returns
//
router.post("/rank", async (req, res) => {
  // TODO: generate multiple variants
  // TODO: Rank by brand consistency
  // TODO: Rank by quality scores
  // TODO: Return ordered results
  res.json({ message: "rank endpoint not implemented yet" });
});

// GET /api/audit
// Returns
//
router.post("/audit", async (req, res) => {
  // TODO:
  res.json({ message: "audit endpoint not implemented yet" });
});

export default router;
