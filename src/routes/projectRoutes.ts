/**
 * routes/projectRoutes.ts
 *
 * Express router configuration for project-related endpoints.
 * Defines routes for project CRUD operations including creation,
 * listing, and updates. All routes require authentication via API key.
 *
 */
import { Router } from "express";
import { ProjectController } from "../controllers/ProjectController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

/**
 * Apply authentication middleware to all project routes
 * Verifies API key and sets clientId in request
 */
router.use(authMiddleware);

/**
 * Create a new project for the authenticated client
 *
 * @route POST /projects/create
 * @authentication Required - API Key
 * @body {Object} project - Project information
 */
router.post("/projects/create", ProjectController.create);

/**
 * List all projects for the authenticated client
 *
 * @route GET /projects
 * @authentication Required - API Key
 */
router.get("/projects", ProjectController.listByClient);

/**
 * Update an existing project
 *
 * @route PUT /projects/:id
 * @authentication Required - API Key
 * @param {string} id - ID of the project to update
 * @body {Object} updates - Project fields to update
 */
router.put("/projects/:id", ProjectController.update);

export default router;
