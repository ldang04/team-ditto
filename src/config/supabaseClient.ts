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

// Initialize and export a Supabase client instance
// - process.env.SUPABASE_URL: the project URL
// - process.env.SUPABASE_SERVICE_KEY: service role key (server-side only)
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
