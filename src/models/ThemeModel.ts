import { supabase } from "../config/supabaseClient";
import { Theme } from "../types";

export const ThemeModel = {
  async listByUser(userId: string) {
    return await supabase.from("themes").select("*").eq("user_id", userId);
  },

  async getById(id: string) {
    return await supabase.from("themes").select("*").eq("id", id).single();
  },

  async create(theme: Theme) {
    return await supabase.from("themes").insert(theme).select().single();
  },
};
