/**
 * models/ProjectModel.ts
 *
 * Data access model for project records stored in Supabase.
 * Handles creation, retrieval, and updates of project information
 * associated with specific users and clients.
 *
 */
import { supabase } from "../config/supabaseClient";
import { Project } from "../types";

export const ProjectModel = {
  /**
   * Retrieve all projects associated with a specific client.
   *
   * @param clientId - The id of the client whose projects should be fetched.
   * @returns A promise resolving to an array of project records or an error.
   *
   */
  async listByClient(clientId: string) {
    return await supabase
      .from("projects")
      .select("*")
      .eq("client_id", clientId);
  },

  /**
   * Retrieve a single project record by its unique ID.
   *
   * @param id - The id of the project.
   * @returns A promise resolving to the matching project record or an error.
   *
   */
  async getById(id: string) {
    return await supabase.from("projects").select("*").eq("id", id).single();
  },

  /**
   * Create a new project record in Supabase.
   *
   * @param project - Object containing project fields.
   * @returns A promise resolving to the inserted project record or an error.
   *
   */
  async create(project: Project) {
    return await supabase.from("projects").insert(project).select().single();
  },

  /**
   * Update an existing project record by ID.
   *
   * @param id - The unique project ID.
   * @param updates - Partial object containing the fields to update.
   * @returns A promise resolving to the updated project record or an error.
   *
   */
  async update(id: string, updates: Partial<Project>) {
    return await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  },
};
