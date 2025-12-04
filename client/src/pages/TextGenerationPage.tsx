import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Sparkles, Loader2, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import type { TextGenerationRequest } from '../types';
import { isProjectReadyForGeneration, analyzeWorkflowStatus } from '../utils/workflow';
import WorkflowBlock from '../components/WorkflowBlock';

export default function TextGenerationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectIdParam = searchParams.get('project_id');

  const [projectId, setProjectId] = useState(projectIdParam || '');
  const [prompt, setPrompt] = useState('');
  const [targetAudience, setTargetAudience] = useState('general');
  const [variantCount, setVariantCount] = useState(3);
  const [stylePreferences, setStylePreferences] = useState({
    tone: '',
    length: '',
    format: '',
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const generateMutation = useMutation({
    mutationFn: (request: TextGenerationRequest) => apiClient.generateText(request),
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
      alert(`Cannot generate content: ${projectValidation.missing.join(', ')}`);
      return;
    }

    // Build style preferences object from form fields
    const stylePrefs: Record<string, any> = {};
    if (stylePreferences.tone) stylePrefs.tone = stylePreferences.tone;
    if (stylePreferences.length) stylePrefs.length = stylePreferences.length;
    if (stylePreferences.format) stylePrefs.format = stylePreferences.format;

    const request: TextGenerationRequest = {
      project_id: projectId,
      prompt,
      target_audience: targetAudience,
      variantCount: variantCount,
      style_preferences: Object.keys(stylePrefs).length > 0 ? stylePrefs : undefined,
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

  // Show workflow blocker if no ready projects
  if (readyProjects.length === 0) {
    if (!workflowStatus.hasTheme) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Text Generation</h1>
            <p className="text-gray-600 mt-2">Generate AI-powered marketing content</p>
          </div>
          <WorkflowBlock
            title="Theme Required"
            message="You need to create a brand theme before generating content. Themes provide the brand guidelines that AI uses to create on-brand content."
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
          <h1 className="text-3xl font-bold text-gray-900">Text Generation</h1>
          <p className="text-gray-600 mt-2">Generate AI-powered marketing content</p>
        </div>
        <WorkflowBlock
          title="Project with Theme Required"
          message="You need to create a project linked to a theme before generating content. Projects without themes cannot generate branded content."
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
        <h1 className="text-3xl font-bold text-gray-900">Text Generation</h1>
        <p className="text-gray-600 mt-2">Generate AI-powered marketing content</p>
      </div>

      {/* Validation Warning */}
      {projectId && !projectValidation.ready && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Project Not Ready</h3>
              <p className="text-red-800 text-sm mb-2">
                This project cannot generate content because: {projectValidation.missing.join(', ')}
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
                    Showing {readyProjects.length} of {projects.length} projects (only projects with themes can generate content)
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

              <div className="space-y-3 pt-2 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700">
                  Style Preferences (Optional)
                </label>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tone</label>
                  <input
                    type="text"
                    value={stylePreferences.tone}
                    onChange={(e) => setStylePreferences({ ...stylePreferences, tone: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., professional, casual, friendly"
                    list="tone-suggestions"
                  />
                  <datalist id="tone-suggestions">
                    <option value="professional" />
                    <option value="casual" />
                    <option value="friendly" />
                    <option value="formal" />
                    <option value="conversational" />
                    <option value="authoritative" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Length</label>
                  <input
                    type="text"
                    value={stylePreferences.length}
                    onChange={(e) => setStylePreferences({ ...stylePreferences, length: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., short, medium, long"
                    list="length-suggestions"
                  />
                  <datalist id="length-suggestions">
                    <option value="short" />
                    <option value="medium" />
                    <option value="long" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Format</label>
                  <input
                    type="text"
                    value={stylePreferences.format}
                    onChange={(e) => setStylePreferences({ ...stylePreferences, format: e.target.value })}
                    className="input text-sm"
                    placeholder="e.g., paragraph, bullet points, headline"
                    list="format-suggestions"
                  />
                  <datalist id="format-suggestions">
                    <option value="paragraph" />
                    <option value="bullet points" />
                    <option value="headline" />
                    <option value="list" />
                  </datalist>
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

