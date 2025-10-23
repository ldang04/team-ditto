/**
 * models/ApiKeyModel.ts
 *
 * Data access model for API key records stored in Supabase.
 * Provides CRUD operations for the `api_keys` table.
 *
 */
import { supabase } from "../config/supabaseClient";
import { ApiKey } from "../types";

export const ApiKeyModel = {
  /**
   * Create a new API key record in Supabase.
   *
   * @param key - Object containing the API key details.
   * @returns A promise resolving to the inserted API key record or an error.
   *
   */
  async create(key: ApiKey): Promise<{ data: ApiKey[] | null; error: any }> {
    return await supabase.from("api_keys").insert(key).select().single();
  },

  /**
   * Update an existing API key record by its unique ID.
   *
   * @param id - The unique identifier of the API key.
   * @param updates - Partial object containing fields to update.
   * @returns A promise resolving to the updated record or an error.
   *
   */
  async update(
    id: string,
    updates: Partial<ApiKey>
  ): Promise<{ data: ApiKey | null; error: any }> {
    return await supabase
      .from("api_keys")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  },

  /**
   * Retrieve a single active API key record by its prefix.
   *
   * The prefix is used for quick lookups without exposing the full key.
   * This query is primarily used for validating incoming API requests.
   *
   * @param prefix - The prefix of the API key.
   * @returns A promise resolving to the matching API key record or null/error if not found.
   *
   */
  async list(prefix: string): Promise<{ data: ApiKey | null; error: any }> {
    return await supabase
      .from("api_keys")
      .select("*")
      .eq("prefix", prefix)
      .single();
  },
};
