/**
 * middleware/auth.ts
 *
 * Middleware to authenticate API requests using a secure API key.
 * The API key is sent in the `Authorization: Bearer <key>` header.
 *
 * Workflow:
 * 1. Extract API key from the Authorization header.
 * 2. Use the first 8 characters of the key as a prefix to fetch the matching key record.
 * 3. Compare the provided key with the hashed key stored in Supabase using bcrypt.
 * 4. If valid, attach the client ID to `req.clientId` for downstream routes.
 * 5. Update the key's `last_used_at` timestamp asynchronously.
 *
 */
import { Request, Response, NextFunction } from "express";
import { ApiKeyModel } from "../models/ApiKeyModel";
import bcrypt from "bcrypt";
import { ServiceResponse } from "../types/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { handleServiceResponse } from "../utils/httpHandlers";
import logger from "../config/logger";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let serviceResponse;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    logger.error("Middleware: Missing API key");
    serviceResponse = ServiceResponse.failure(
      null,
      "Missing API key",
      StatusCodes.UNAUTHORIZED
    );
    return handleServiceResponse(serviceResponse, res);
  }

  const providedKey = header.split(" ")[1];
  // Use a short prefix of the key to query the database
  const prefix = providedKey.slice(0, 8);

  // Fetch the key record from Supabase using prefix with active status
  const { data: keyRecord, error } = await ApiKeyModel.list(prefix);

  // If key not found, deny access
  if (error || !keyRecord || !keyRecord.id) {
    logger.error("Middleware: Invalid API key");
    serviceResponse = ServiceResponse.failure(
      null,
      "Invalid API key",
      StatusCodes.FORBIDDEN
    );
    return handleServiceResponse(serviceResponse, res);
  }

  // Compare the provided key with the stored hashed key
  const valid = await bcrypt.compare(providedKey, keyRecord.hashed_key);
  if (!valid) {
    logger.error("Middleware: Invalid API key");
    serviceResponse = ServiceResponse.failure(
      null,
      "Invalid API key",
      StatusCodes.FORBIDDEN
    );
    return handleServiceResponse(serviceResponse, res);
  }

  // Attach client ID to request object for use in downstream routes
  req.clientId = keyRecord.client_id;

  // Update the keys last_used_at timestamp
  await ApiKeyModel.update(keyRecord.id!, { last_used_at: new Date() });

  // Call next() to continue request handling
  next();
}
