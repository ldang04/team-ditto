import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Palette, Plus, Loader2, X } from 'lucide-react';
import type { Theme } from '../types';

export default function ThemesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: themesData, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const createMutation = useMutation({
    mutationFn: (theme: Partial<Theme>) => apiClient.createTheme(theme),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      setShowForm(false);
      setIsCreating(false);
    },
  });

  const themes = themesData?.data || [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const tags = formData.get('tags')?.toString().split(',').map(t => t.trim()).filter(Boolean) || [];
    const inspirations = formData.get('inspirations')?.toString().split(',').map(i => i.trim()).filter(Boolean) || [];

    const theme: Partial<Theme> = {
      name: formData.get('name')?.toString() || '',
      font: formData.get('font')?.toString() || '',
      tags,
      inspirations,
    };

    createMutation.mutate(theme);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brand Themes</h1>
          <p className="text-gray-600 mt-2">Manage your brand themes and visual styles</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Create Theme
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Create New Theme</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="input"
                placeholder="e.g., Modern Tech, Elegant Luxury"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font
              </label>
              <input
                type="text"
                name="font"
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
                name="tags"
                className="input"
                placeholder="e.g., modern, professional, minimalist"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate multiple tags with commas
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inspirations (comma-separated)
              </label>
              <input
                type="text"
                name="inspirations"
                className="input"
                placeholder="e.g., Apple, Google, Tesla"
              />
              <p className="text-xs text-gray-500 mt-1">
                Brands or styles that inspire this theme
              </p>
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
                    Creating...
                  </>
                ) : (
                  'Create Theme'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Themes Grid */}
      {isLoading ? (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
        </div>
      ) : themes.length === 0 ? (
        <div className="card text-center py-12">
          <Palette className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No themes yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first brand theme to get started
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Create Theme
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themes.map((theme) => (
            <div key={theme.id} className="card">
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-purple-100 p-3 rounded-lg">
                  <Palette className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {theme.name}
                  </h3>
                  {theme.font && (
                    <p className="text-sm text-gray-600 mt-1">Font: {theme.font}</p>
                  )}
                </div>
              </div>

              {theme.tags && theme.tags.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {theme.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {theme.inspirations && theme.inspirations.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Inspirations</p>
                  <div className="flex flex-wrap gap-2">
                    {theme.inspirations.map((insp, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-md"
                      >
                        {insp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {theme.analysis && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Style Score:</span>
                      <span className="font-semibold text-gray-900 ml-1">
                        {theme.analysis.style_score}/100
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Brand Strength:</span>
                      <span className="font-semibold text-gray-900 ml-1">
                        {theme.analysis.brand_strength}/100
                      </span>
                    </div>
                  </div>
                  {theme.analysis.visual_mood && (
                    <p className="text-xs text-gray-600 mt-2">
                      Mood: {theme.analysis.visual_mood}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

