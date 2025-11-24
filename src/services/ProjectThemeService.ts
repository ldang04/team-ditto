/**
 * services/ProjectThemeService.ts
 *
 * Shared service for fetching project and theme data.
 * Reduces duplication across controllers.
 */

import { ProjectModel } from "../models/ProjectModel";
import { ThemeModel } from "../models/ThemeModel";
import logger from "../config/logger";
import { Project, Theme } from "../types";

interface ProjectThemeData {
  project: Project;
  theme: Theme;
}

export const ProjectThemeService = {
  /**
   * Fetches project and its associated theme
   *
   * @param project_id - The project ID
   * @returns Object containing project and theme, or null if not found
   */
  async getProjectAndTheme(
    project_id: string
  ): Promise<ProjectThemeData | null> {
    try {
      logger.info(
        `ProjectThemeService: get project and theme for ${project_id}`
      );
      // Fetch project
      const { data: project, error: projectError } = await ProjectModel.getById(
        project_id
      );

      if (projectError || !project) {
        logger.error(`Project not found: ${project_id}`, projectError);
        return null;
      }

      // Fetch theme
      const { data: theme, error: themeError } = await ThemeModel.getById(
        project.theme_id
      );

      if (themeError || !theme) {
        logger.error(`Theme not found for project: ${project_id}`, themeError);
        return null;
      }

      return { project, theme };
    } catch (error) {
      logger.error(
        "ProjectThemeService: Error fetching project and theme:",
        error
      );
      return null;
    }
  },
};
