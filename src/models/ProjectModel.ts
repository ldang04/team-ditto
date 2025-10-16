import { supabase } from "../config/supabaseClient";
import { Project } from "../types";

export const ProjectModel = {
  async listByUser(userId: string) {
    return await supabase.from("projects").select("*").eq("user_id", userId);
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
