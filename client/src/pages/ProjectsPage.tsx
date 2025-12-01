import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { FolderKanban, Plus, Loader2, X, Edit2 } from 'lucide-react';
import type { Project, Theme } from '../types';

export default function ProjectsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const createMutation = useMutation({
    mutationFn: (project: Partial<Project>) => apiClient.createProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Project> }) =>
      apiClient.updateProject(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingId(null);
      setShowForm(false);
    },
  });

  const projects = projectsData?.data || [];
  const themes = themesData?.data || [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const project: Partial<Project> = {
      name: formData.get('name')?.toString() || '',
      description: formData.get('description')?.toString() || '',
      goals: formData.get('goals')?.toString() || '',
      customer_type: formData.get('customer_type')?.toString() || '',
      theme_id: formData.get('theme_id')?.toString() || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: project });
    } else {
      createMutation.mutate(project);
    }
  };

  const editingProject = projects.find((p) => p.id === editingId);

  const startEdit = (project: Project) => {
    setEditingId(project.id || null);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-2">Manage your marketing projects</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowForm(!showForm);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Project
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingId ? 'Edit Project' : 'Create New Project'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="input"
                placeholder="e.g., Summer Campaign 2024"
                defaultValue={editingProject?.name || ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="input"
                placeholder="Describe your project goals and objectives"
                defaultValue={editingProject?.description || ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Goals
              </label>
              <textarea
                name="goals"
                rows={2}
                className="input"
                placeholder="What are you trying to achieve?"
                defaultValue={editingProject?.goals || ''}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Type
              </label>
              <input
                type="text"
                name="customer_type"
                className="input"
                placeholder="e.g., Tech professionals, Small business owners"
                defaultValue={editingProject?.customer_type || ''}
              />
              <p className="text-xs text-gray-500 mt-1">
                Required for content validation
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <select name="theme_id" className="input" defaultValue={editingProject?.theme_id || ''}>
                <option value="">No theme</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreating}
                className="btn btn-primary flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editingId ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  editingId ? 'Update Project' : 'Create Project'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Projects Grid */}
      {projectsLoading ? (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-12">
          <FolderKanban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No projects yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first project to start generating content
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const theme = themes.find((t) => t.id === project.theme_id);
            return (
              <div
                key={project.id}
                className="card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <FolderKanban className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {project.name}
                      </h3>
                      {theme && (
                        <p className="text-sm text-purple-600 mt-1">
                          Theme: {theme.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(project);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-1"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="space-y-2 text-sm">
                  {project.goals && (
                    <div>
                      <span className="text-gray-500">Goals:</span>
                      <span className="text-gray-900 ml-2">{project.goals}</span>
                    </div>
                  )}
                  {project.customer_type && (
                    <div>
                      <span className="text-gray-500">Audience:</span>
                      <span className="text-gray-900 ml-2">{project.customer_type}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

