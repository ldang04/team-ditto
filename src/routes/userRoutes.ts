/**
 * routes/userRoutes.ts
 *
 * This file defines the Express routes for ...
 * All routes are protected via API key middleware, ensuring multi-tenant isolation.
 *
 */
import { Router } from "express";
import { UserController } from "../controllers/UserController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

// List users for the authenticated client
router.get("/users", UserController.list);

// Create a new user
router.post("/users/create", UserController.create);

// Update an existing user
router.patch("/users/:id", UserController.update);

export default router;
