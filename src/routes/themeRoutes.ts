/**
 * routes/themeRoutes.ts
 *
 * Express router configuration for theme-related endpoints.
 * Defines routes for managing theme operations including creation
 * and retrieval. All routes require authentication via API key.
 * Themes define visual and behavioral customization options for projects.
 *
 * @module ThemeRoutes
 */
import { Router } from "express";
import { ThemeController } from "../controllers/ThemeController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

/**
 * Apply authentication middleware to all theme routes
 * Verifies API key and sets clientId in request
 */
router.use(authMiddleware);

/**
 * Create a new theme for the authenticated client
 *
 * @route POST /themes/create
 * @authentication Required - API Key
 * @body {Object} theme - Theme information
 */
router.post("/themes/create", ThemeController.create);

/**
 * List all themes for the authenticated client
 *
 * @route GET /themes
 * @authentication Required - API Key
 */
router.get("/themes", ThemeController.listByClient);

export default router;
