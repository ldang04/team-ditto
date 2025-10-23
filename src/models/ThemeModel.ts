/**
 * models/ThemeModel.ts
 *
 * Data access model for theme records stored in Supabase.
 * Handles creation and retrieval of user-defined brand themes that include
 * visual styles, fonts, and inspirations for marketing content.
 *
 */
import { supabase } from "../config/supabaseClient";
import { Theme } from "../types";

export const ThemeModel = {
  /**
   * Retrieve all themes associated with a specific client.
   *
   * @param clientId - The id of the client whose themes should be fetched.
   * @returns A promise resolving to an array of theme records or an error.
   *
   */
  async listByClient(clientId: string) {
    return await supabase.from("themes").select("*").eq("client_id", clientId);
  },

  /**
   * Retrieve a single theme record by its unique ID.
   *
   * @param id - The id of the theme to fetch.
   * @returns A promise resolving to the matching theme record or an error.
   *
   */
  async getById(id: string) {
    return await supabase.from("themes").select("*").eq("id", id).single();
  },

  /**
   * Create a new theme record in Supabase.
   *
   * @param theme - Object containing theme details.
   * @returns A promise resolving to the inserted theme record or an error.
   *
   */
  async create(theme: Theme) {
    return await supabase.from("themes").insert(theme).select().single();
  },
};
