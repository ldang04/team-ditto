/**
 * routes/projectRoutes.ts
 *
 * This file defines the Express routes for ...
 * All routes are protected via API key middleware, ensuring multi-tenant isolation.
 *
 */
import { Router } from "express";
import { ProjectController } from "../controllers/ProjectController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

// Create project
router.post("/projects/create", ProjectController.create);

// List projects by user
router.get("/projects/:user_id", ProjectController.listByUser);

// Update project
router.patch("/projects/:id", ProjectController.update);

export default router;
