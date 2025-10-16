import { supabase } from "../config/supabaseClient";
import { Client } from "../types";

export const ClientModel = {
  async create(client: Client): Promise<{ data: Client | null; error: any }> {
    return await supabase.from("clients").insert(client).select().single();
  },
};
