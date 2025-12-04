import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Palette,
  FileText,
  Image as ImageIcon,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { analyzeWorkflowStatus } from '../utils/workflow';
import WorkflowWizard from '../components/WorkflowWizard';

export default function Dashboard() {
  const { clientName } = useAuth();
  const [showWizard, setShowWizard] = useState(false);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData, isLoading: themesLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const projects = projectsData?.data || [];
  const themes = themesData?.data || [];
  const workflowStatus = analyzeWorkflowStatus(themes, projects);

  const readyProjects = projects.filter(p => 
    p.theme_id && p.theme_id.trim() !== '' && p.customer_type
  );

  // Show wizard if user hasn't completed setup
  if (showWizard || (!workflowStatus.isReady && !projectsLoading && !themesLoading)) {
    return (
      <div className="space-y-6">
        <WorkflowWizard onComplete={() => setShowWizard(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {clientName ? `Welcome back, ${clientName}` : 'Dashboard'}
        </h1>
        <p className="text-gray-600 mt-2">Welcome to BrandForge Studio</p>
      </div>

      {/* Workflow Status Banner */}
      {!workflowStatus.isReady && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                Complete Your Setup
              </h3>
              <p className="text-yellow-800 mb-4">
                {workflowStatus.currentStep === 'theme' && 
                  "Create a brand theme to get started with content generation."}
                {workflowStatus.currentStep === 'project' && 
                  "Create a project linked to a theme to start generating content."}
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Complete Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Progress Indicator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`card ${workflowStatus.hasTheme ? 'bg-green-50 border-green-200' : ''}`}>
          <div className="flex items-center gap-3">
            {workflowStatus.hasTheme ? (
              <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
            ) : (
              <Palette className="h-8 w-8 text-gray-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Theme</p>
              <p className={`text-2xl font-bold ${workflowStatus.hasTheme ? 'text-green-700' : 'text-gray-400'}`}>
                {workflowStatus.themeCount}
              </p>
            </div>
          </div>
          {!workflowStatus.hasTheme && (
            <Link to="/themes" className="text-sm text-primary-600 hover:text-primary-700 mt-2 block">
              Create theme →
            </Link>
          )}
        </div>

        <div className={`card ${workflowStatus.hasProject ? 'bg-blue-50 border-blue-200' : ''}`}>
          <div className="flex items-center gap-3">
            {workflowStatus.hasProject ? (
              <CheckCircle2 className="h-8 w-8 text-blue-600 flex-shrink-0" />
            ) : (
              <FolderKanban className="h-8 w-8 text-gray-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Projects</p>
              <p className={`text-2xl font-bold ${workflowStatus.hasProject ? 'text-blue-700' : 'text-gray-400'}`}>
                {workflowStatus.projectCount}
              </p>
            </div>
          </div>
          {!workflowStatus.hasProject && (
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 mt-2 block">
              Create project →
            </Link>
          )}
        </div>

        <div className={`card ${workflowStatus.isReady ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {workflowStatus.isReady ? (
              <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-8 w-8 text-gray-400 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Ready Projects</p>
              <p className={`text-2xl font-bold ${workflowStatus.isReady ? 'text-green-700' : 'text-gray-400'}`}>
                {workflowStatus.readyProjectCount}
              </p>
            </div>
          </div>
          {workflowStatus.isReady ? (
            <p className="text-xs text-green-700 mt-2">Ready for generation</p>
          ) : (
            <p className="text-xs text-gray-500 mt-2">Need theme + project</p>
          )}
        </div>
      </div>

      {/* Quick Actions - Only show if ready */}
      {workflowStatus.isReady && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              to="/generate/text"
              className="card hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="bg-green-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Create Text Content
              </h3>
              <p className="text-sm text-gray-600">Generate AI-powered text content</p>
            </Link>
            <Link
              to="/generate/image"
              className="card hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="bg-pink-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <ImageIcon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Create Images
              </h3>
              <p className="text-sm text-gray-600">Generate branded images with AI</p>
            </Link>
            <Link
              to="/validate"
              className="card hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <div className="bg-orange-500 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Validate Content
              </h3>
              <p className="text-sm text-gray-600">Check content against brand guidelines</p>
            </Link>
          </div>
        </div>
      )}

      {/* Ready Projects */}
      {readyProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Ready Projects</h2>
            <Link
              to="/projects"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {readyProjects.slice(0, 6).map((project) => {
              const theme = themes.find((t) => t.id === project.theme_id);
              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FolderKanban className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {project.name}
                      </h3>
                      {theme && (
                        <p className="text-sm text-purple-600 mt-1">
                          Theme: {theme.name}
                        </p>
                      )}
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  </div>
                  {project.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}
                  <div className="flex gap-2 mt-4">
                    <Link
                      to={`/generate/text?project_id=${project.id}`}
                      className="flex-1 btn btn-secondary text-sm text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Generate Text
                    </Link>
                    <Link
                      to={`/generate/image?project_id=${project.id}`}
                      className="flex-1 btn btn-secondary text-sm text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Generate Image
                    </Link>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!workflowStatus.isReady && projects.length === 0 && themes.length === 0 && (
        <div className="card text-center py-12">
          <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Get Started
          </h3>
          <p className="text-gray-600 mb-6">
            Follow the workflow to create your first theme and project
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="btn btn-primary flex items-center gap-2 mx-auto"
          >
            <Play className="h-4 w-4" />
            Start Workflow
          </button>
        </div>
      )}
    </div>
  );
}
