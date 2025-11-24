/**
 * models/EmbeddingsModel.ts
 *
 * Data access model for embedding records stored in Supabase.
 * Handles creation and retrieval of vector embeddings associated with content.
 *
 */
import { supabase } from "../config/supabaseClient";
import { Embedding } from "../types";
import type { PostgrestResponse } from "@supabase/supabase-js";

export const EmbeddingsModel = {
  /**
   * Create a new embedding record for a given piece of content.
   *
   * @param embedding - Object containing embedding details.
   * @returns A promise resolving to the inserted embedding record or an error.
   *
   */
  async create(embedding: Embedding) {
    return await supabase
      .from("embeddings")
      .insert(embedding)
      .select()
      .single();
  },

  /**
   * Retrieve all embedding records for a specific content item.
   *
   * @param contentId - The id of the content associated with the embeddings.
   * @returns A promise resolving to all embeddings linked to the given content ID or an error.
   *
   */
  async getByContentId(
    contentId: string
  ): Promise<PostgrestResponse<Embedding>> {
    return await supabase
      .from("embeddings")
      .select("*")
      .eq("content_id", contentId);
  },
};
