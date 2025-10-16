/**
 * routes/clientRoutes.ts
 *
 * This file defines the Express routes for ...
 * All routes are protected via API key middleware, ensuring multi-tenant isolation.
 *
 */
import express from "express";
import { ClientController } from "../controllers/ClientController";

const router = express.Router();

// POST /api/clients/create
router.post("/clients/create", ClientController.createClient);

export default router;
