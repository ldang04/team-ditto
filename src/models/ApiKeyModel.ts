import { supabase } from "../config/supabaseClient";
import { ApiKey } from "../types";

export const ApiKeyModel = {
  async create(key: ApiKey): Promise<{ data: ApiKey[] | null; error: any }> {
    return await supabase.from("api_keys").insert(key);
  },
};
