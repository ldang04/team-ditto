/**
 * routes/clientRoutes.ts
 *
 * Express router configuration for client-related endpoints.
 * Defines routes for client management operations including
 * client registration and API key generation.
 *
 */
import express from "express";
import { ClientController } from "../controllers/ClientController";

const router = express.Router();

/**
 * Create a new client account
 *
 * @route POST /clients/create
 * @body {Object} client - Client information
 */
router.post("/clients/create", ClientController.createClient);

export default router;
