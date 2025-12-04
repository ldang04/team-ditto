import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Image as ImageIcon, Loader2, Download, TrendingUp, AlertCircle } from 'lucide-react';
import type { ImageGenerationRequest, Project, Theme } from '../types';
import { isProjectReadyForGeneration, analyzeWorkflowStatus } from '../utils/workflow';
import WorkflowBlock from '../components/WorkflowBlock';

export default function ImageGenerationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectIdParam = searchParams.get('project_id');

  const [projectId, setProjectId] = useState(projectIdParam || '');
  const [prompt, setPrompt] = useState('');
  const [targetAudience, setTargetAudience] = useState('general');
  const [variantCount, setVariantCount] = useState(3);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [stylePreferences, setStylePreferences] = useState({
    composition: '',
    lighting: '',
    avoid: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const generateMutation = useMutation({
    mutationFn: (request: ImageGenerationRequest) => apiClient.generateImage(request),
  });

  const projects = projectsData?.data || [];
  const themes = themesData?.data || [];
  
  // Filter to only show projects ready for generation (have theme_id)
  const readyProjects = projects.filter(p => 
    p.theme_id && p.theme_id.trim() !== ''
  );
  const selectedProject = projects.find(p => p.id === projectId);
  const projectValidation = isProjectReadyForGeneration(selectedProject);
  const workflowStatus = analyzeWorkflowStatus(themes, projects);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !prompt) return;

    // Validate project before submission
    if (!projectValidation.ready) {
      alert(`Cannot generate images: ${projectValidation.missing.join(', ')}`);
      return;
    }

    // Build style preferences object from form fields
    const stylePrefs: Record<string, any> = {};
    if (stylePreferences.composition) stylePrefs.composition = stylePreferences.composition;
    if (stylePreferences.lighting) stylePrefs.lighting = stylePreferences.lighting;
    if (stylePreferences.avoid) stylePrefs.avoid = stylePreferences.avoid;

    const request: ImageGenerationRequest = {
      project_id: projectId,
      prompt,
      target_audience: targetAudience,
      variantCount: variantCount,
      aspectRatio: aspectRatio,
      style_preferences: Object.keys(stylePrefs).length > 0 ? stylePrefs : undefined,
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

  // Show workflow blocker if no ready projects
  if (readyProjects.length === 0) {
    if (!workflowStatus.hasTheme) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Image Generation</h1>
            <p className="text-gray-600 mt-2">Generate AI-powered branded images</p>
          </div>
          <WorkflowBlock
            title="Theme Required"
            message="You need to create a brand theme before generating images. Themes provide the brand guidelines and visual style that AI uses to create on-brand images."
            missingItem="theme"
            actionHref="/themes"
            actionText="Create Theme"
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Image Generation</h1>
          <p className="text-gray-600 mt-2">Generate AI-powered branded images</p>
        </div>
        <WorkflowBlock
          title="Project with Theme Required"
          message="You need to create a project linked to a theme before generating images. Projects without themes cannot generate branded images with RAG and theme analysis."
          missingItem="project-with-theme"
          actionHref="/projects"
          actionText="Create Project"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Image Generation</h1>
        <p className="text-gray-600 mt-2">Generate AI-powered branded images</p>
      </div>

      {/* Validation Warning */}
      {projectId && !projectValidation.ready && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Project Not Ready</h3>
              <p className="text-red-800 text-sm mb-2">
                This project cannot generate images because: {projectValidation.missing.join(', ')}
              </p>
              <button
                onClick={() => navigate(`/projects/${projectId}`)}
                className="text-sm text-red-700 hover:text-red-900 underline"
              >
                Edit project to add theme →
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {readyProjects.map((project) => {
                    const theme = themes.find((t) => t.id === project.theme_id);
                    return (
                      <option key={project.id} value={project.id}>
                        {project.name} {theme ? `(${theme.name})` : ''}
                      </option>
                    );
                  })}
                </select>
                {projects.length > readyProjects.length && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing {readyProjects.length} of {projects.length} projects (only projects with themes can generate images)
                  </p>
                )}
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

              <div className="space-y-3 pt-2 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700">
                  Style Preferences (Optional)
                </label>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Composition</label>
                  <input
                    type="text"
                    value={stylePreferences.composition}
                    onChange={(e) => setStylePreferences({ ...stylePreferences, composition: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., centered, rule of thirds, symmetrical"
                    list="composition-suggestions"
                  />
                  <datalist id="composition-suggestions">
                    <option value="centered" />
                    <option value="rule of thirds" />
                    <option value="symmetrical" />
                    <option value="dynamic" />
                    <option value="minimalist" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Lighting</label>
                  <input
                    type="text"
                    value={stylePreferences.lighting}
                    onChange={(e) => setStylePreferences({ ...stylePreferences, lighting: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., natural, soft, dramatic, bright"
                    list="lighting-suggestions"
                  />
                  <datalist id="lighting-suggestions">
                    <option value="natural" />
                    <option value="soft" />
                    <option value="dramatic" />
                    <option value="bright" />
                    <option value="warm" />
                    <option value="cool" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Avoid</label>
                  <input
                    type="text"
                    value={stylePreferences.avoid}
                    onChange={(e) => setStylePreferences({ ...stylePreferences, avoid: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., text, watermarks, blur"
                  />
                  <p className="text-xs text-gray-500 mt-1">Elements to avoid in the image</p>
                </div>
              </div>

              <button
                type="submit"
                disabled={generateMutation.isPending || !projectId || !prompt || !projectValidation.ready}
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

