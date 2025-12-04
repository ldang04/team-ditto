import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import type { ValidationRequest, Content } from '../types';
import LinkedInPreview from '../components/LinkedInPreview';

export default function ValidationPage() {
  const [contentText, setContentText] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: contentData } = useQuery({
    queryKey: ['validation-content', projectId],
    queryFn: () => apiClient.getContent(projectId),
    enabled: !!projectId,
  });

  const validateTextMutation = useMutation({
    mutationFn: (request: ValidationRequest) => apiClient.validateContent(request),
  });

  const validateImageMutation = useMutation({
    mutationFn: (contentId: string) => apiClient.validateContent({ content_id: contentId }),
  });

  const projects = projectsData?.data || [];
  const allContents: Content[] = (contentData?.data as Content[]) || [];
  const imageContents = allContents.filter((c) => c.media_type === 'image');
  const recentImages = [...imageContents]
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 9);

  const selectedImage = recentImages.find((img) => img.id === selectedImageId) || null;

  const hasInput = contentText.trim().length > 0 || !!selectedImage;

  const previewTextContent: Content = {
    id: 'preview-text',
    project_id: projectId || '',
    media_type: 'text',
    media_url: 'text',
    text_content: hasInput ? contentText : 'A preview will appear once inputted.',
    created_at: new Date().toISOString(),
  };

  const previewImageContent: Content | undefined = selectedImage ? { ...selectedImage } : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId && !contentText.trim() && !selectedImageId) return;

    if (contentText.trim() && projectId) {
      const request: ValidationRequest = {
        content: contentText,
        project_id: projectId,
      };
      validateTextMutation.mutate(request);
    }

    if (selectedImageId) {
      validateImageMutation.mutate(selectedImageId);
    }
  };

  const textResult = validateTextMutation.data?.data?.validation;
  const imageResult = validateImageMutation.data?.data?.validation;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const hasValidationState =
    validateTextMutation.isPending ||
    validateImageMutation.isPending ||
    validateTextMutation.isError ||
    validateImageMutation.isError ||
    validateTextMutation.isSuccess ||
    validateImageMutation.isSuccess;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Content Validation</h1>
        <p className="text-gray-500 mt-1">
          Validate LinkedIn-style posts against your brand guidelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign *
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Select a campaign</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Content Text
                </label>
                <textarea
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  rows={6}
                  className="input"
                  placeholder="Paste or type the content to validate..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image (most recent from campaign)
                </label>
                {!projectId && (
                  <p className="text-xs text-gray-400">
                    Select a campaign to see recent images.
                  </p>
                )}
                {projectId && recentImages.length === 0 && (
                  <p className="text-xs text-gray-400">
                    No images found yet for this campaign.
                  </p>
                )}
                {projectId && recentImages.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {recentImages.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() =>
                          setSelectedImageId(
                            img.id === selectedImageId ? null : (img.id as string),
                          )
                        }
                        className={`relative border rounded-md overflow-hidden focus:outline-none ${
                          img.id === selectedImageId
                            ? 'ring-2 ring-blue-500 border-blue-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={img.media_url}
                          alt="Recent campaign image"
                          className="w-full h-20 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={validateTextMutation.isPending || validateImageMutation.isPending}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {validateTextMutation.isPending || validateImageMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Validate Content
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Preview & Results */}
        <div className="lg:col-span-2">
          {hasValidationState ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* LinkedIn-style Preview */}
              <div>
                <LinkedInPreview
                  textContent={previewTextContent}
                  imageContent={previewImageContent}
                  createdAt={new Date().toISOString()}
                  showHeaderActions={false}
                />
              </div>

              {/* Validation Results */}
              <div className="space-y-4 text-sm">
                {(validateTextMutation.isPending || validateImageMutation.isPending) && (
                  <div className="card text-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">
                      Analyzing content against brand guidelines...
                    </p>
                  </div>
                )}

                {validateTextMutation.isError && (
                  <div className="card bg-red-50 border-red-200 text-xs">
                    <p className="text-red-700 leading-snug">
                      {validateTextMutation.error instanceof Error
                        ? validateTextMutation.error.message
                        : 'Failed to validate content'}
                    </p>
                  </div>
                )}

                {/* Text Validation Results */}
                {validateTextMutation.isSuccess && textResult && (
                  <div className="space-y-4 text-xs">
                    {/* Overall Score */}
                    <div className="card">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">Text Validation</h2>
                          <p className="text-xs text-gray-600 mt-1">{textResult.summary}</p>
                        </div>
                        <div
                          className={`${getScoreBgColor(
                            textResult.overall_score,
                          )} px-3 py-2 rounded-lg text-center`}
                        >
                          <p className="text-[11px] text-gray-600 mb-0.5">Overall</p>
                          <p
                            className={`text-xl font-bold ${getScoreColor(
                              textResult.overall_score,
                            )}`}
                          >
                            {textResult.overall_score}
                          </p>
                          {textResult.passes_validation ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto mt-1" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mx-auto mt-1" />
                          )}
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-[11px] text-gray-600 mb-0.5">Brand Consistency</p>
                          <p
                            className={`text-lg font-semibold ${getScoreColor(
                              textResult.brand_consistency_score,
                            )}`}
                          >
                            {textResult.brand_consistency_score}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-[11px] text-gray-600 mb-0.5">Quality</p>
                          <p
                            className={`text-lg font-semibold ${getScoreColor(
                              textResult.quality_score,
                            )}`}
                          >
                            {textResult.quality_score}
                          </p>
                        </div>
                      </div>

                      {/* Strengths */}
                      {textResult.strengths && textResult.strengths.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Strengths
                          </h3>
                          <ul className="space-y-1.5">
                            {textResult.strengths.map((strength: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1.5 text-gray-700">
                                <span className="text-green-600 mt-0.5">✓</span>
                                <span className="leading-snug">{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Issues */}
                      {textResult.issues && textResult.issues.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            Issues
                          </h3>
                          <div className="space-y-2">
                            {textResult.issues.map((issue, idx: number) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border ${
                                  issue.severity === 'major'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-yellow-50 border-yellow-200'
                                }`}
                              >
                                <div className="flex items-start gap-1.5 mb-1.5">
                                  <span
                                    className={`font-medium ${
                                      issue.severity === 'major'
                                        ? 'text-red-700'
                                        : 'text-yellow-700'
                                    }`}
                                  >
                                    {issue.severity === 'major' ? 'Major' : 'Minor'} -{' '}
                                    {issue.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-700 mb-1">
                                  {issue.description}
                                </p>
                                <p className="text-[11px] text-gray-600">
                                  <span className="font-medium">Suggestion:</span>{' '}
                                  {issue.suggestion}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {textResult.recommendations && textResult.recommendations.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary-600" />
                            Recommendations
                          </h3>
                          <ul className="space-y-1.5">
                            {textResult.recommendations.map((rec: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1.5 text-gray-700">
                                <span className="text-primary-600 mt-0.5">•</span>
                                <span className="leading-snug">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Image Validation Results */}
                {validateImageMutation.isSuccess && imageResult && (
                  <div className="space-y-4 text-xs">
                    <div className="card">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-sm font-semibold text-gray-900">Image Validation</h2>
                          <p className="text-xs text-gray-600 mt-1">{imageResult.summary}</p>
                        </div>
                        <div
                          className={`${getScoreBgColor(
                            imageResult.overall_score,
                          )} px-3 py-2 rounded-lg text-center`}
                        >
                          <p className="text-[11px] text-gray-600 mb-0.5">Overall</p>
                          <p
                            className={`text-xl font-bold ${getScoreColor(
                              imageResult.overall_score,
                            )}`}
                          >
                            {imageResult.overall_score}
                          </p>
                          {imageResult.passes_validation ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto mt-1" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 mx-auto mt-1" />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-[11px] text-gray-600 mb-0.5">Brand Consistency</p>
                          <p
                            className={`text-2xl font-bold ${getScoreColor(
                              imageResult.brand_consistency_score,
                            )}`}
                          >
                            {imageResult.brand_consistency_score}
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-[11px] text-gray-600 mb-0.5">Quality</p>
                          <p
                            className={`text-2xl font-bold ${getScoreColor(
                              imageResult.quality_score,
                            )}`}
                          >
                            {imageResult.quality_score}
                          </p>
                        </div>
                      </div>

                      {imageResult.strengths && imageResult.strengths.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Strengths
                          </h3>
                          <ul className="space-y-1.5">
                            {imageResult.strengths.map((strength: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-gray-700">
                                <span className="text-green-600 mt-0.5">✓</span>
                                <span className="leading-snug">{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {imageResult.issues && imageResult.issues.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            Issues
                          </h3>
                          <div className="space-y-2">
                            {imageResult.issues.map((issue, idx: number) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border ${
                                  issue.severity === 'major'
                                    ? 'bg-red-50 border-red-200'
                                    : 'bg-yellow-50 border-yellow-200'
                                }`}
                              >
                                <div className="flex items-start gap-1.5 mb-1.5">
                                  <span
                                    className={`font-medium ${
                                      issue.severity === 'major'
                                        ? 'text-red-700'
                                        : 'text-yellow-700'
                                    }`}
                                  >
                                    {issue.severity === 'major' ? 'Major' : 'Minor'} -{' '}
                                    {issue.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-700 mb-1">
                                  {issue.description}
                                </p>
                                <p className="text-[11px] text-gray-600">
                                  <span className="font-medium">Suggestion:</span>{' '}
                                  {issue.suggestion}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {imageResult.recommendations && imageResult.recommendations.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary-600" />
                            Recommendations
                          </h3>
                          <ul className="space-y-1.5">
                            {imageResult.recommendations.map((rec: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-1.5 text-gray-700">
                                <span className="text-primary-600 mt-0.5">•</span>
                                <span className="leading-snug">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <LinkedInPreview
                textContent={previewTextContent}
                imageContent={previewImageContent}
                createdAt={new Date().toISOString()}
                showHeaderActions={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


