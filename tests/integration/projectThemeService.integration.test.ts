/**
 * Project Theme Service — Integration Tests (no mocks)
 *
 * Integrates:
 * - ProjectThemeService.getProjectAndTheme orchestrates ProjectModel.getById + ThemeModel.getById.
 * - Service reduces duplication across controllers needing project+theme pairs.
 *
 * External:
 * - Supabase DB queries for project and theme records.
 */

process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "team-ditto";

import { supabase } from "../../src/config/supabaseClient";
import { ProjectThemeService } from "../../src/services/ProjectThemeService";

describe("Project Theme Service Integration", () => {
  jest.setTimeout(15000);
  let clientId: string | undefined;
  let projectId: string | undefined;
  let themeId: string | undefined;

  /**
   * Integrates: Test data setup via ProjectModel + ThemeModel.
   * External: Supabase DB inserts for client, theme, project.
   * Validates: we have test fixtures for service integration tests.
   */
  beforeAll(async () => {
    // Insert a client
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .insert({ name: "ProjectThemeService Int Client" })
      .select()
      .single();
    expect(clientError).toBeNull();
    clientId = clientData?.id;

    // Insert a theme
    const { data: themeData, error: themeError } = await supabase
      .from("themes")
      .insert({
        client_id: clientId,
        name: "Test Theme",
        tags: ["modern", "professional"],
        font: ["Arial"],
      })
      .select()
      .single();
    expect(themeError).toBeNull();
    themeId = themeData?.id;

    // Insert a project with theme binding
    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: clientId,
        name: "ProjectThemeService Test Project",
        theme_id: themeId,
      })
      .select()
      .single();
    expect(projectError).toBeNull();
    projectId = projectData?.id;
  });

  /**
   * Integrates: ProjectThemeService.getProjectAndTheme → ProjectModel.getById + ThemeModel.getById.
   * External: Supabase DB queries for project and theme by id.
   * Validates: service returns both project and theme records when both exist.
   */
  it("returns project and theme when both exist", async () => {
    if (!projectId) {
      return;
    }
    const result = await ProjectThemeService.getProjectAndTheme(projectId);

    expect(result).not.toBeNull();
    expect(result?.project).toBeDefined();
    expect(result?.project?.id).toBe(projectId);
    expect(result?.project?.client_id).toBe(clientId);
    expect(result?.theme).toBeDefined();
    expect(result?.theme?.id).toBe(themeId);
    expect(result?.theme?.name).toBe("Test Theme");
  });

  /**
   * Integrates: ProjectThemeService.getProjectAndTheme with non-existent project id.
   * External: Supabase DB query returns no records.
   * Validates: service returns null when project not found.
   */
  it("returns null when project does not exist", async () => {
    const result = await ProjectThemeService.getProjectAndTheme(
      "00000000-0000-0000-0000-000000000000"
    );

    expect(result).toBeNull();
  });

  /**
   * Integrates: Project + Theme retrieval when theme is missing/deleted.
   * External: Supabase DB: project exists but theme_id references non-existent record.
   * Validates: service returns null when theme lookup fails.
   */
  it("returns null when theme does not exist for project", async () => {
    if (!clientId) {
      return;
    }
    // Create a project with a non-existent theme_id
    const fakeThemeId = "00000000-0000-0000-0000-000000000001";
    const { data: orphanProject } = await supabase
      .from("projects")
      .insert({
        client_id: clientId,
        name: "Orphan Project",
        theme_id: fakeThemeId,
      })
      .select()
      .single();

    if (!orphanProject?.id) {
      return;
    }

    const result = await ProjectThemeService.getProjectAndTheme(
      orphanProject.id
    );

    expect(result).toBeNull();

    // Cleanup
    await supabase.from("projects").delete().eq("id", orphanProject.id);
  });

  /**
   * Integrates: Service error handling with exception.
   * External: Invalid project id format (not UUID).
   * Validates: service catches error and returns null gracefully.
   */
  it("handles invalid project id gracefully", async () => {
    const result = await ProjectThemeService.getProjectAndTheme("invalid-id");

    expect(result).toBeNull();
  });

  /**
   * Cleanup: Remove test data after all tests.
   * External: Supabase DB deletes.
   * Validates: no leftover records.
   */
  afterAll(async () => {
    if (projectId) {
      await supabase.from("projects").delete().eq("id", projectId);
    }
    if (themeId) {
      await supabase.from("themes").delete().eq("id", themeId);
    }
    if (clientId) {
      await supabase.from("clients").delete().eq("id", clientId);
    }
  });
});
