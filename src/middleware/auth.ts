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
import bcrypt from "bcrypt";
import { supabase } from "../config/supabaseClient";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing API key" });
  }

  const providedKey = header.split(" ")[1];
  // Use a short prefix of the key to query the database
  const prefix = providedKey.slice(0, 8);

  // Fetch the key record from Supabase using prefix with active status
  const { data: keyRecord, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("prefix", prefix)
    .eq("active", true)
    .single();

  // If key not found, deny access
  if (error || !keyRecord) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  // Compare the provided key with the stored hashed key
  const valid = await bcrypt.compare(providedKey, keyRecord.hashed_key);
  if (!valid) {
    return res.status(403).json({ error: "Invalid API key" });
  }

  // Attach client ID to request object for use in downstream routes
  req.clientId = keyRecord.client_id;

  // Update the keys last_used_at timestamp
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date() })
    .eq("id", keyRecord.id);

  // Call next() to continue request handling
  next();
}
