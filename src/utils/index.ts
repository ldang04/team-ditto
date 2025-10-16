/**
 * utils.ts
 *
 * This file defines ...
 *
 */
import crypto from "crypto";

export function generateApiKey() {
  const key = crypto.randomBytes(32).toString("hex");
  const prefix = key.slice(0, 8);
  return { key, prefix };
}
