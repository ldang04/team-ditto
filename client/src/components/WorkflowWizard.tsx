import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Palette, FolderKanban, CheckCircle2, ArrowRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Theme, Project } from '../types';
import { analyzeWorkflowStatus } from '../utils/workflow';
import { Loader2 } from 'lucide-react';

interface WorkflowWizardProps {
  onComplete?: () => void;
}

export default function WorkflowWizard({ onComplete }: WorkflowWizardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<'theme' | 'project'>('theme');
  const [themeFormData, setThemeFormData] = useState({
    name: '',
    font: '',
    tags: '',
    inspirations: '',
  });
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    description: '',
    goals: '',
    customer_type: '',
  });
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const themes = themesData?.data || [];
  const projects = projectsData?.data || [];
  const workflowStatus = analyzeWorkflowStatus(themes, projects);

  const createThemeMutation = useMutation({
    mutationFn: (theme: Partial<Theme>) => apiClient.createTheme(theme),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      if (currentStep === 'theme') {
        setCurrentStep('project');
      }
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (project: Partial<Project>) => apiClient.createProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (onComplete) {
        onComplete();
      } else {
        navigate('/');
      }
    },
  });

  const handleCreateTheme = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = themeFormData.tags.split(',').map(t => t.trim()).filter(Boolean);
    const inspirations = themeFormData.inspirations.split(',').map(i => i.trim()).filter(Boolean);
    
    createThemeMutation.mutate({
      name: themeFormData.name,
      font: themeFormData.font || undefined,
      tags,
      inspirations,
    });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThemeId) {
      alert('Please select a theme');
      return;
    }

    createProjectMutation.mutate({
      name: projectFormData.name,
      description: projectFormData.description || undefined,
      goals: projectFormData.goals || undefined,
      customer_type: projectFormData.customer_type || undefined,
      theme_id: selectedThemeId,
    });
  };

  const steps = [
    {
      id: 'theme',
      title: 'Create Brand Theme',
      description: 'Define your brand style and guidelines',
      icon: Palette,
      completed: workflowStatus.hasTheme,
    },
    {
      id: 'project',
      title: 'Create Project',
      description: 'Set up your marketing project with a theme',
      icon: FolderKanban,
      completed: workflowStatus.hasProjectWithTheme,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to BrandForge Studio</h1>
        <p className="text-gray-600">Let's get you set up with a quick workflow</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = step.completed;
          
          return (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center mb-2
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isActive && !isCompleted ? 'bg-primary-600 text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <div className="text-center">
                  <p className={`text-sm font-medium ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Create Theme */}
      {currentStep === 'theme' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Create Your Brand Theme</h2>
          <p className="text-gray-600 mb-6">
            A theme defines your brand's visual style, inspirations, and guidelines that will be used for all content generation.
          </p>
          
          {workflowStatus.hasTheme ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">You already have a theme! Ready to create a project.</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateTheme} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme Name *
                </label>
                <input
                  type="text"
                  value={themeFormData.name}
                  onChange={(e) => setThemeFormData({ ...themeFormData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Modern Tech, Elegant Luxury"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font
                </label>
                <input
                  type="text"
                  value={themeFormData.font}
                  onChange={(e) => setThemeFormData({ ...themeFormData, font: e.target.value })}
                  className="input"
                  placeholder="e.g., Roboto, Inter, Playfair Display"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={themeFormData.tags}
                  onChange={(e) => setThemeFormData({ ...themeFormData, tags: e.target.value })}
                  className="input"
                  placeholder="e.g., modern, professional, minimalist"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple tags with commas</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inspirations (comma-separated) *
                </label>
                <input
                  type="text"
                  value={themeFormData.inspirations}
                  onChange={(e) => setThemeFormData({ ...themeFormData, inspirations: e.target.value })}
                  className="input"
                  placeholder="e.g., Apple, Google, Tesla"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Brands or styles that inspire this theme</p>
              </div>
              <button
                type="submit"
                disabled={createThemeMutation.isPending}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {createThemeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Theme
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {workflowStatus.hasTheme && (
            <button
              onClick={() => setCurrentStep('project')}
              className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              Continue to Project
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Step 2: Create Project */}
      {currentStep === 'project' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Step 2: Create Your Project</h2>
          <p className="text-gray-600 mb-6">
            A project is your marketing campaign. It must be linked to a theme for content generation to work.
          </p>

          {workflowStatus.hasProjectWithTheme ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">You have a project ready for content generation!</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Theme *
                </label>
                <select
                  value={selectedThemeId}
                  onChange={(e) => setSelectedThemeId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Choose a theme...</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
                {themes.length === 0 && (
                  <p className="text-sm text-red-600 mt-1">
                    No themes available. Please create a theme first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectFormData.name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                  className="input"
                  placeholder="e.g., Summer Campaign 2024"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={projectFormData.description}
                  onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                  rows={3}
                  className="input"
                  placeholder="Describe your project goals and objectives"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Goals
                </label>
                <textarea
                  value={projectFormData.goals}
                  onChange={(e) => setProjectFormData({ ...projectFormData, goals: e.target.value })}
                  rows={2}
                  className="input"
                  placeholder="What are you trying to achieve?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Type *
                </label>
                <input
                  type="text"
                  value={projectFormData.customer_type}
                  onChange={(e) => setProjectFormData({ ...projectFormData, customer_type: e.target.value })}
                  className="input"
                  placeholder="e.g., Tech professionals, Small business owners"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Required for content validation</p>
              </div>

              <button
                type="submit"
                disabled={createProjectMutation.isPending || !selectedThemeId}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Project & Finish Setup
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {workflowStatus.hasProjectWithTheme && (
            <div className="mt-6">
              <button
                onClick={() => {
                  if (onComplete) {
                    onComplete();
                  } else {
                    navigate('/');
                  }
                }}
                className="btn btn-primary w-full"
              >
                Start Creating Content
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

