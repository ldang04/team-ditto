import { supabase } from "../config/supabaseClient";
import { Content } from "../types";

export const ContentModel = {
  async listByProject(projectId: string) {
    return await supabase
      .from("contents")
      .select("*")
      .eq("project_id", projectId);
  },

  async create(content: Content) {
    return await supabase.from("contents").insert(content).select().single();
  },
};
