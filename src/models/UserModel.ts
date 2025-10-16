import { supabase } from "../config/supabaseClient";
import { User } from "../types";

export const UserModel = {
  async listByClient(clientId: string) {
    return await supabase.from("users").select("*").eq("client_id", clientId);
  },

  async create(user: User) {
    return await supabase.from("users").insert(user).select().single();
  },

  async update(id: string, updates: Partial<User>) {
    return await supabase
      .from("users")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  },
};
