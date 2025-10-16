import { supabase } from "../config/supabaseClient";
import { Theme } from "../types";

export const ThemeModel = {
  async listByUser(userId: string) {
    return await supabase.from("themes").select("*").eq("user_id", userId);
  },

  async create(theme: Theme) {
    return await supabase.from("themes").insert(theme).select().single();
  },
};
