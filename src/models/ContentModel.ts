/**
 * models/ContentModel.ts
 *
 * Data access model for content records stored in Supabase.
 * Handles creation and retrieval of generated content
 * associated with a specific project.
 *
 */
import { supabase } from "../config/supabaseClient";
import { Content } from "../types";
import type { PostgrestResponse } from "@supabase/supabase-js";

export const ContentModel = {
  /**
   * Retrieve all content records for a specific project.
   *
   * @param projectId - The id of the project whose content should be fetched.
   * @returns A promise resolving to an array of content records or an error.
   *
   */
  async listByProject(projectId: string): Promise<PostgrestResponse<Content>> {
    return await supabase
      .from("contents")
      .select("*")
      .eq("project_id", projectId);
  },

  /**
   * Create a new content record linked to a project.
   *
   * @param content - The content object including project_id, media type, URLs, and metadata.
   * @returns A promise resolving to the inserted content record or an error.
   *
   */
  async create(
    content: Content
  ): Promise<{ data: Content | null; error: any }> {
    return await supabase.from("contents").insert(content).select().single();
  },

  /**
   * Update the media_url for a content record.
   *
   * @param contentId - The id of the content to update.
   * @param mediaUrl - The new media URL to set on the record.
   * @returns A promise resolving to the updated content record or an error.
   */
  async updateMediaUrl(contentId: string, mediaUrl: string) {
    // Update the media_url field and return the single updated row
    return await supabase
      .from("contents")
      .update({ media_url: mediaUrl })
      .eq("id", contentId)
      .select()
      .single();
  },

  /**
   * Retrieve single content by its unique ID.
   *
   * @param contentId - The id of the content.
   * @returns A promise resolving to the matching content record or an error.
   *
   */
  async getById(contentId: string) {
    return await supabase
      .from("contents")
      .select("*")
      .eq("id", contentId)
      .single();
  },

  /**
   * Retrieve multiple content records by their IDs.
   *
   * @param contentIds - Array of content IDs to fetch.
   * @returns A promise resolving to an array of content records or an error.
   *
   */
  async getByIds(contentIds: string[]): Promise<PostgrestResponse<Content>> {
    return await supabase
      .from("contents")
      .select("*")
      .in("id", contentIds);
  },
};
