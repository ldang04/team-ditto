import { supabase } from "../config/supabaseClient";
import { Theme } from "../types";

export const ThemeModel = {
  async listByClient(clientId: string) {
    return await supabase.from("themes").select("*").eq("client_id", clientId);
  },

  async getById(id: string) {
    return await supabase.from("themes").select("*").eq("id", id).single();
  },

  async create(theme: Theme) {
    return await supabase.from("themes").insert(theme).select().single();
  },
};
