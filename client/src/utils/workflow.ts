import type { Project, Theme } from '../types';

export type WorkflowStep = 'theme' | 'project' | 'ready';

export interface WorkflowStatus {
  hasTheme: boolean;
  hasProject: boolean;
  hasProjectWithTheme: boolean;
  currentStep: WorkflowStep;
  isReady: boolean;
  themeCount: number;
  projectCount: number;
  readyProjectCount: number;
}

/**
 * Analyzes workflow status based on themes and projects
 */
export function analyzeWorkflowStatus(
  themes: Theme[] = [],
  projects: Project[] = []
): WorkflowStatus {
  const hasTheme = themes.length > 0;
  const hasProject = projects.length > 0;
  
  // Projects that are ready for generation (have theme_id)
  const readyProjects = projects.filter(p => p.theme_id && p.theme_id.trim() !== '');
  const hasProjectWithTheme = readyProjects.length > 0;

  // Determine current workflow step
  let currentStep: WorkflowStep = 'theme';
  if (hasTheme && !hasProjectWithTheme) {
    currentStep = 'project';
  } else if (hasProjectWithTheme) {
    currentStep = 'ready';
  }

  return {
    hasTheme,
    hasProject,
    hasProjectWithTheme,
    currentStep,
    isReady: hasProjectWithTheme,
    themeCount: themes.length,
    projectCount: projects.length,
    readyProjectCount: readyProjects.length,
  };
}

/**
 * Validates if a project is ready for content generation
 */
export function isProjectReadyForGeneration(project: Project | undefined): {
  ready: boolean;
  missing: string[];
} {
  if (!project) {
    return { ready: false, missing: ['Project not found'] };
  }

  const missing: string[] = [];
  
  if (!project.theme_id || project.theme_id.trim() === '') {
    missing.push('Theme must be linked to project');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

