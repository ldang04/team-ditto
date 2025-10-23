/**
 * models/ClientModel.ts
 *
 * Data access model for client records stored in Supabase.
 * Handles creation and retrieval of client metadata such as organization name
 * and other identifying information.
 *
 */
import { supabase } from "../config/supabaseClient";
import { Client } from "../types";

export const ClientModel = {
  /**
   * Create a new client record in Supabase.
   *
   * @param client - Object containing client fields (e.g., name, organization, created_at).
   * @returns A promise resolving to the inserted client record or an error.
   *
   */
  async create(client: Client): Promise<{ data: Client | null; error: any }> {
    return await supabase.from("clients").insert(client).select().single();
  },
};
