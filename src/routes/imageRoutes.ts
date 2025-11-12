/**
 * routes/imageRoutes.ts
 *
 * Routes for image generation using Vertex AI Imagen.
 * All routes are protected via API key middleware.
 */
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { ImageGenerationController } from "../controllers/ImageGenerationController";

const router = Router();
router.use(authMiddleware);

/**
 * Generate images using AI with RAG and computational analysis
 *
 * @route POST /api/images/generate
 * @param {string} req.body.project_id - The ID of the project
 * @param {string} req.body.prompt - The user's image generation prompt
 * @param {Object} [req.body.style_preferences={}] - Style preferences for image generation
 * @param {string} [req.body.target_audience=general] - Target audience for the content
 * @param {number} [req.body.variantCount=3] - Number of image variants to generate (1-4)
 * @param {string} [req.body.aspectRatio=1:1] - Image aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
 * @returns {Object} Response containing the generated images with computation metrics
 * @throws {400} If project_id or prompt is missing
 * @throws {404} If project or theme not found
 * @throws {500} If image generation fails
 */
router.post("/generate", ImageGenerationController.generate);

export default router;
