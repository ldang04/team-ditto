/**
 * routes/textRoutes.ts
 *
 * Routes for text content generation using Vertex AI Gemini.
 * All routes are protected via API key middleware.
 */
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { TextGenerationController } from "../controllers/TextGenerationController";

const router = Router();
router.use(authMiddleware);

/**
 * Generate text content using AI
 *
 * @route POST /api/text/generate
 * @param {string} req.body.project_id - The ID of the project
 * @param {string} req.body.prompt - The user's content generation prompt
 * @param {Object} [req.body.style_preferences={}] - Style preferences for content generation
 * @param {string} [req.body.target_audience=general] - Target audience for the content
 * @param {number} [req.body.variantCount=3] - Number of content variants to generate
 * @param {string} [req.body.media_type=text] - Type of text content (text, post, article, etc.)
 * @returns {Object} Response containing the generated text variants
 * @throws {400} If project_id or prompt is missing
 * @throws {404} If project or theme not found
 * @throws {500} If text generation fails
 */
router.post("/generate", TextGenerationController.generate);

export default router;
