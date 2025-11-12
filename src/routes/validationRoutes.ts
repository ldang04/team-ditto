/**
 * routes/validationRoutes.ts
 *
 * Routes for content validation against brand guidelines.
 * All routes are protected via API key middleware.
 */
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { ValidationController } from "../controllers/ValidationController";

const router = Router();
router.use(authMiddleware);

/**
 * Validate content against brand guidelines and quality standards
 *
 * @route POST /api/validate
 * @param {string} [req.body.content_id] - ID of existing content to validate
 * @param {string} [req.body.content] - Raw content text to validate
 * @param {string} [req.body.project_id] - Required if validating raw content
 * @returns {Object} Validation report with scores, issues, and recommendations
 * @throws {400} If neither content_id nor (content + project_id) is provided
 * @throws {404} If content or project not found
 * @throws {500} If validation fails
 */
router.post("/", ValidationController.validate);

export default router;
