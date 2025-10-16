/**
 * routes/themeRoutes.ts
 *
 * This file defines the Express routes for ...
 * All routes are protected via API key middleware, ensuring multi-tenant isolation.
 *
 */
import { Router } from "express";
import { ThemeController } from "../controllers/ThemeController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

// Create theme
router.post("/themes/create", ThemeController.create);

// List themes by user
router.get("/themes/:user_id", ThemeController.listByUser);

export default router;
