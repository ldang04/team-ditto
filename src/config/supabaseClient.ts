/**
 * config/supabaseClient.ts
 *
 * This module initializes and exports a Supabase client for use throughout
 * the service.
 *
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables from .env file into process.env
dotenv.config();

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required. Please check your .env file.");
}
if (!process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY is required. Please check your .env file.");
}

// Initialize and export a Supabase client instance
// - process.env.SUPABASE_URL: the project URL
// - process.env.SUPABASE_SERVICE_KEY: service role key (server-side only)
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
