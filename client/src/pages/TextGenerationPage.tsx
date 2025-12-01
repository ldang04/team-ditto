import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Sparkles, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import type { TextGenerationRequest } from '../types';

export default function TextGenerationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectIdParam = searchParams.get('project_id');

  const [projectId, setProjectId] = useState(projectIdParam || '');
  const [prompt, setPrompt] = useState('');
  const [targetAudience, setTargetAudience] = useState('general');
  const [variantCount, setVariantCount] = useState(3);
  const [stylePreferences, setStylePreferences] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const generateMutation = useMutation({
    mutationFn: (request: TextGenerationRequest) => apiClient.generateText(request),
  });

  const projects = projectsData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !prompt) return;

    const request: TextGenerationRequest = {
      project_id: projectId,
      prompt,
      target_audience: targetAudience,
      variantCount: variantCount,
      style_preferences: stylePreferences ? JSON.parse(stylePreferences) : {},
    };

    generateMutation.mutate(request);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    if (projectIdParam) {
      setProjectId(projectIdParam);
    }
  }, [projectIdParam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Text Generation</h1>
        <p className="text-gray-600 mt-2">Generate AI-powered marketing content</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project *
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prompt *
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="input"
                  placeholder="Describe what you want to generate..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="input"
                  placeholder="e.g., Tech professionals, Small business owners"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Variants (0-10)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={variantCount}
                  onChange={(e) => setVariantCount(parseInt(e.target.value) || 0)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Style Preferences (JSON, optional)
                </label>
                <textarea
                  value={stylePreferences}
                  onChange={(e) => setStylePreferences(e.target.value)}
                  rows={3}
                  className="input font-mono text-sm"
                  placeholder='{"tone": "professional", "length": "medium"}'
                />
              </div>

              <button
                type="submit"
                disabled={generateMutation.isPending || !projectId || !prompt}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Content
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {generateMutation.isPending && (
            <div className="card text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">Generating content variants...</p>
            </div>
          )}

          {generateMutation.isError && (
            <div className="card bg-red-50 border-red-200">
              <p className="text-red-700">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : 'Failed to generate content'}
              </p>
            </div>
          )}

          {generateMutation.isSuccess && generateMutation.data.data && (
            <div className="space-y-4">
              <div className="card bg-green-50 border-green-200">
                <p className="text-green-700 font-medium">
                  ✓ Generated {generateMutation.data.data.variant_count} variant(s) successfully!
                </p>
              </div>

              {generateMutation.data.data.variants.map((variant, idx) => (
                <div key={variant.content_id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Variant {idx + 1}
                    </h3>
                    <button
                      onClick={() => copyToClipboard(variant.generated_content, variant.content_id)}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    >
                      {copiedId === variant.content_id ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {variant.generated_content}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => navigate(`/validate?content_id=${variant.content_id}`)}
                      className="btn btn-secondary text-sm"
                    >
                      Validate This Content
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!generateMutation.isPending &&
            !generateMutation.isSuccess &&
            !generateMutation.isError && (
              <div className="card text-center py-12">
                <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Generate
                </h3>
                <p className="text-gray-600">
                  Fill out the form and click "Generate Content" to create AI-powered text
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

