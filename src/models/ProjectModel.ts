import { supabase } from "../config/supabaseClient";
import { Project } from "../types";

export const ProjectModel = {
  async listByClient(clientId: string) {
    return await supabase.from("projects").select("*").eq("client_id", clientId);
  },

  async getById(id: string) {
    return await supabase.from("projects").select("*").eq("id", id).single();
  },

  async create(project: Project) {
    return await supabase.from("projects").insert(project).select().single();
  },

  async update(id: string, updates: Partial<Project>) {
    return await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  },
};
