import { supabase } from "../config/supabaseClient";
import { Embedding } from "../types";

export const EmbeddingsModel = {
  async create(embedding: Embedding) {
    return await supabase.from("embeddings").insert(embedding).select().single();
  },

  async getByContentId(contentId: string) {
    return await supabase.from("embeddings").select("*").eq("content_id", contentId);
  },
};
