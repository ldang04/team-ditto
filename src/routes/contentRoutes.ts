/**
 * routes/contentRoutes.ts
 *
 * Express router configuration for content-related endpoints.
 * Defines routes for managing project content operations.
 * All routes require authentication via API key.
 *
 */
import { Router } from "express";
import { ContentController } from "../controllers/ContentController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

/**
 * Apply authentication middleware to all content routes
 * Verifies API key and sets clientId in request
 */
router.use(authMiddleware);

/**
 * List all content items for a specific project
 *
 * @route GET /contents/:project_id
 * @authentication Required - API Key
 * @param {string} project_id - ID of the project to fetch content for
 */
router.get("/contents/:project_id", ContentController.list);

export default router;
