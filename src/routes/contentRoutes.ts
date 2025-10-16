/**
 * routes/contentRoutes.ts
 *
 * This file defines the Express routes for ...
 * All routes are protected via API key middleware, ensuring multi-tenant isolation.
 *
 */
import { Router } from "express";
import { ContentController } from "../controllers/ContentController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

// Create content
router.post("/contents/create", ContentController.create);

// List content by project
router.get("/contents/:project_id", ContentController.list);

export default router;
