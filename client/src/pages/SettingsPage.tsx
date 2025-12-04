import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import {
  Settings,
  Palette,
  Plus,
  Loader2,
  Key,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

export default function SettingsPage() {
  const { apiKey, clientName } = useAuth();
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState(false);
  const [showAddTheme, setShowAddTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeTags, setNewThemeTags] = useState('');
  const [newThemeInspirations, setNewThemeInspirations] = useState('');

  const { data: themesData, isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const createThemeMutation = useMutation({
    mutationFn: () => apiClient.createTheme({
      name: newThemeName,
      tags: newThemeTags.split(',').map(t => t.trim()).filter(Boolean),
      inspirations: newThemeInspirations.split(',').map(i => i.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      setShowAddTheme(false);
      setNewThemeName('');
      setNewThemeTags('');
      setNewThemeInspirations('');
    },
  });

  const themes = themesData?.data || [];

  const handleCopyApiKey = async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleAddTheme = (e: React.FormEvent) => {
    e.preventDefault();
    createThemeMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-gray-600">
          Manage your brand themes and account settings
        </p>
      </div>

      {/* Account Section */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="h-5 w-5 text-gray-500" />
          Account
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <p className="text-gray-900">{clientName || 'Not set'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono text-gray-700 truncate">
                {apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-8)}` : 'Not available'}
              </code>
              <button
                onClick={handleCopyApiKey}
                className="btn btn-secondary flex items-center gap-2"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use this key to access the Ditto API from other applications
            </p>
          </div>
        </div>
      </div>

      {/* Brand Themes Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="h-5 w-5 text-gray-500" />
            Brand Themes
          </h2>
          <button
            onClick={() => setShowAddTheme(true)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Theme
          </button>
        </div>

        {/* Add Theme Form */}
        {showAddTheme && (
          <form onSubmit={handleAddTheme} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-3">New Brand Theme</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme Name *
                </label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="e.g., Modern Tech"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords
                </label>
                <input
                  type="text"
                  value={newThemeTags}
                  onChange={(e) => setNewThemeTags(e.target.value)}
                  placeholder="e.g., modern, professional, innovative"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inspirations
                </label>
                <input
                  type="text"
                  value={newThemeInspirations}
                  onChange={(e) => setNewThemeInspirations(e.target.value)}
                  placeholder="e.g., Apple, Nike, Stripe"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated brands you admire</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newThemeName || createThemeMutation.isPending}
                  className="btn btn-primary"
                >
                  {createThemeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Create Theme'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTheme(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Themes List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : themes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Palette className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No brand themes yet</p>
            <button
              onClick={() => setShowAddTheme(true)}
              className="text-primary-600 hover:text-primary-700 text-sm mt-2"
            >
              Create your first theme
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {themes.map((theme) => (
              <div
                key={theme.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-200 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary-500" />
                    <h3 className="font-medium text-gray-900">{theme.name}</h3>
                  </div>
                  {theme.tags && theme.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {theme.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {theme.inspirations && theme.inspirations.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Inspired by: {theme.inspirations.join(', ')}
                    </p>
                  )}
                </div>
                {theme.analysis && (
                  <div className="text-right">
                    <div className="text-sm">
                      <span className="text-gray-500">Brand Strength:</span>{' '}
                      <span className="font-medium text-primary-600">
                        {theme.analysis.brand_strength}/100
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {theme.analysis.visual_mood}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation Link */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-1">Building your own integration?</h3>
        <p className="text-sm text-blue-700">
          Use your API key to connect other applications to the Ditto Content API.
          Check out the API documentation in the main project README for endpoints and examples.
        </p>
      </div>
    </div>
  );
}
