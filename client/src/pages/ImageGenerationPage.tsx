import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Image as ImageIcon, Loader2, Download, TrendingUp } from 'lucide-react';
import type { ImageGenerationRequest } from '../types';

export default function ImageGenerationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectIdParam = searchParams.get('project_id');

  const [projectId, setProjectId] = useState(projectIdParam || '');
  const [prompt, setPrompt] = useState('');
  const [targetAudience, setTargetAudience] = useState('general');
  const [variantCount, setVariantCount] = useState(3);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [stylePreferences, setStylePreferences] = useState('');

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const generateMutation = useMutation({
    mutationFn: (request: ImageGenerationRequest) => apiClient.generateImage(request),
  });

  const projects = projectsData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !prompt) return;

    const request: ImageGenerationRequest = {
      project_id: projectId,
      prompt,
      target_audience: targetAudience,
      variantCount: variantCount,
      aspectRatio: aspectRatio,
      style_preferences: stylePreferences ? JSON.parse(stylePreferences) : {},
    };

    generateMutation.mutate(request);
  };

  const downloadImage = (url: string, filename: string) => {
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      });
  };

  useEffect(() => {
    if (projectIdParam) {
      setProjectId(projectIdParam);
    }
  }, [projectIdParam]);

  const aspectRatios = ['1:1', '16:9', '9:16', '4:5', '3:2'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Image Generation</h1>
        <p className="text-gray-600 mt-2">Generate AI-powered branded images</p>
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
                  placeholder="Describe the image you want to generate..."
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
                  Number of Variants (1-4)
                </label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={variantCount}
                  onChange={(e) => setVariantCount(parseInt(e.target.value) || 1)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="input"
                >
                  {aspectRatios.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
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
                  placeholder='{"style": "modern", "color_scheme": "vibrant"}'
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
                    <ImageIcon className="h-4 w-4" />
                    Generate Images
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
              <p className="text-gray-600">Generating images with AI...</p>
              <p className="text-sm text-gray-500 mt-2">
                This may take a minute
              </p>
            </div>
          )}

          {generateMutation.isError && (
            <div className="card bg-red-50 border-red-200">
              <p className="text-red-700">
                {generateMutation.error instanceof Error
                  ? generateMutation.error.message
                  : 'Failed to generate images'}
              </p>
            </div>
          )}

          {generateMutation.isSuccess && generateMutation.data.data && (
            <div className="space-y-6">
              <div className="card bg-green-50 border-green-200">
                <p className="text-green-700 font-medium">
                  ✓ Generated {generateMutation.data.data.variant_count} image(s) successfully!
                </p>
              </div>

              {/* Metrics */}
              {generateMutation.data.data.computation_metrics && (
                <div className="card bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Generation Metrics</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">RAG Similarity:</span>
                      <p className="font-semibold text-gray-900">
                        {(generateMutation.data.data.computation_metrics.rag_similarity * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Prompt Quality:</span>
                      <p className="font-semibold text-gray-900">
                        {generateMutation.data.data.computation_metrics.prompt_quality.toFixed(1)}/100
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Predicted Quality:</span>
                      <p className="font-semibold text-gray-900">
                        {generateMutation.data.data.computation_metrics.predicted_quality.toFixed(1)}/100
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">RAG Context Items:</span>
                      <p className="font-semibold text-gray-900">
                        {generateMutation.data.data.computation_metrics.rag_context_items}
                      </p>
                    </div>
                  </div>
                  {generateMutation.data.data.computation_metrics.theme_analysis && (
                    <div className="mt-4 pt-4 border-t border-blue-200">
                      <p className="text-xs text-gray-600 mb-2">Visual Mood:</p>
                      <p className="font-medium text-gray-900">
                        {generateMutation.data.data.computation_metrics.theme_analysis.visual_mood}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generateMutation.data.data.variants.map((variant, idx) => (
                  <div key={variant.content_id} className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Variant {idx + 1}
                      </h3>
                      <button
                        onClick={() => downloadImage(variant.image_url, `image-${variant.content_id}.png`)}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                    <div className="mb-4">
                      <img
                        src={variant.image_url}
                        alt={`Generated variant ${idx + 1}`}
                        className="w-full rounded-lg border border-gray-200"
                      />
                    </div>
                    {variant.enhancedPrompt && (
                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Enhanced Prompt:</p>
                        <p className="text-sm text-gray-700">{variant.enhancedPrompt}</p>
                      </div>
                    )}
                    <div className="mt-4">
                      <button
                        onClick={() => navigate(`/validate?content_id=${variant.content_id}`)}
                        className="btn btn-secondary text-sm w-full"
                      >
                        Validate This Image
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!generateMutation.isPending &&
            !generateMutation.isSuccess &&
            !generateMutation.isError && (
              <div className="card text-center py-12">
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Generate
                </h3>
                <p className="text-gray-600">
                  Fill out the form and click "Generate Images" to create AI-powered branded images
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

