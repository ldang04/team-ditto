/**
 * routes/rankingRoutes.ts
 *
 * Routes for ranking content against project themes.
 * All routes are protected via API key middleware.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { RankingController } from "../controllers/RankingController";

const router = Router();
router.use(authMiddleware);

/**
 * Rank content items by their alignment with project theme and quality
 *
 * @route POST /api/rank
 * @param {string} [req.body.project_id] - Project ID to rank all content for
 * @param {string[]} [req.body.content_ids] - Specific content IDs to rank
 * @param {number} [req.body.limit] - Limit number of results (optional)
 * @returns {Object} Ranked list of content with scores and recommendations
 * @throws {400} If neither project_id nor content_ids provided
 * @throws {404} If project or content not found
 * @throws {500} If ranking fails
 */
router.post("/", RankingController.rank);

export default router;

