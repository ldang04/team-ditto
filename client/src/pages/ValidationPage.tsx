import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import type { ValidationRequest } from '../types';

export default function ValidationPage() {
  const [searchParams] = useSearchParams();
  const contentIdParam = searchParams.get('content_id');

  const [validationMode, setValidationMode] = useState<'content_id' | 'text'>('content_id');
  const [contentId, setContentId] = useState(contentIdParam || '');
  const [contentText, setContentText] = useState('');
  const [projectId, setProjectId] = useState('');

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const validateMutation = useMutation({
    mutationFn: (request: ValidationRequest) => apiClient.validateContent(request),
  });

  const projects = projectsData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let request: ValidationRequest;
    if (validationMode === 'content_id') {
      if (!contentId) return;
      request = { content_id: contentId };
    } else {
      if (!contentText || !projectId) return;
      request = { content: contentText, project_id: projectId };
    }

    validateMutation.mutate(request);
  };

  useEffect(() => {
    if (contentIdParam) {
      setContentId(contentIdParam);
      setValidationMode('content_id');
    }
  }, [contentIdParam]);

  const result = validateMutation.data?.data?.validation;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Validation</h1>
        <p className="text-gray-600 mt-2">Validate content against brand guidelines</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="card sticky top-8">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Validation Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValidationMode('content_id')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    validationMode === 'content_id'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  By Content ID
                </button>
                <button
                  type="button"
                  onClick={() => setValidationMode('text')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    validationMode === 'text'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  By Text
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {validationMode === 'content_id' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content ID *
                  </label>
                  <input
                    type="text"
                    value={contentId}
                    onChange={(e) => setContentId(e.target.value)}
                    className="input"
                    placeholder="Enter content ID"
                    required
                  />
                </div>
              ) : (
                <>
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
                      Content Text *
                    </label>
                    <textarea
                      value={contentText}
                      onChange={(e) => setContentText(e.target.value)}
                      rows={6}
                      className="input"
                      placeholder="Paste or type the content to validate..."
                      required
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={validateMutation.isPending}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {validateMutation.isPending ? (
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

        {/* Results */}
        <div className="lg:col-span-2">
          {validateMutation.isPending && (
            <div className="card text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">Analyzing content against brand guidelines...</p>
            </div>
          )}

          {validateMutation.isError && (
            <div className="card bg-red-50 border-red-200">
              <p className="text-red-700">
                {validateMutation.error instanceof Error
                  ? validateMutation.error.message
                  : 'Failed to validate content'}
              </p>
            </div>
          )}

          {validateMutation.isSuccess && result && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Validation Results</h2>
                    <p className="text-gray-600 mt-1">{result.summary}</p>
                  </div>
                  <div
                    className={`${getScoreBgColor(result.overall_score)} px-6 py-4 rounded-lg text-center`}
                  >
                    <p className="text-sm text-gray-600 mb-1">Overall Score</p>
                    <p className={`text-4xl font-bold ${getScoreColor(result.overall_score)}`}>
                      {result.overall_score}
                    </p>
                    {result.passes_validation ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mt-2" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600 mx-auto mt-2" />
                    )}
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Brand Consistency</p>
                    <p className={`text-2xl font-bold ${getScoreColor(result.brand_consistency_score)}`}>
                      {result.brand_consistency_score}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Quality Score</p>
                    <p className={`text-2xl font-bold ${getScoreColor(result.quality_score)}`}>
                      {result.quality_score}
                    </p>
                  </div>
                </div>

                {/* Strengths */}
                {result.strengths && result.strengths.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      Strengths
                    </h3>
                    <ul className="space-y-2">
                      {result.strengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-700">
                          <span className="text-green-600 mt-1">✓</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Issues */}
                {result.issues && result.issues.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Issues
                    </h3>
                    <div className="space-y-3">
                      {result.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${
                            issue.severity === 'major'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span
                              className={`font-medium ${
                                issue.severity === 'major' ? 'text-red-700' : 'text-yellow-700'
                              }`}
                            >
                              {issue.severity === 'major' ? 'Major' : 'Minor'} - {issue.category}
                            </span>
                          </div>
                          <p className="text-gray-700 mb-2">{issue.description}</p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Suggestion:</span> {issue.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary-600" />
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-gray-700">
                          <span className="text-primary-600 mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {!validateMutation.isPending &&
            !validateMutation.isSuccess &&
            !validateMutation.isError && (
              <div className="card text-center py-12">
                <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Validate
                </h3>
                <p className="text-gray-600">
                  Enter a content ID or paste text to validate against brand guidelines
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

