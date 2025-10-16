/**
 * types/express.d.ts
 *
 * Type augmentation for Express Request object.
 * Adds a custom property `clientId` to store the ID of the client
 * associated with the API key in the middleware.
 *
 */
import express from "express";

declare global {
  namespace Express {
    interface Request {
      clientId?: string;
    }
  }
}
