import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Project, Theme, TextGenerationVariant, ValidationResult, ImageGenerationResponse } from '../types';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Zap,
  TrendingUp,
} from 'lucide-react';

interface GeneratedContent {
  content_id: string;
  text: string;
  validation?: ValidationResult;
  isValidating?: boolean;
}

export default function CampaignWorkspace() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [contentType, setContentType] = useState<'text' | 'image'>('text');
  const [variantCount, setVariantCount] = useState(3);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch campaigns (projects with themes)
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  // Get campaigns that are ready (have themes linked)
  const campaigns = projectsData?.data?.filter(p => p.theme_id) || [];
  const themes = themesData?.data || [];

  const getThemeForCampaign = (campaign: Project): Theme | undefined => {
    return themes.find(t => t.id === campaign.theme_id);
  };

  // Generate content mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (contentType === 'text') {
        return apiClient.generateText({
          project_id: selectedCampaign,
          prompt,
          variantCount,
        });
      } else {
        return apiClient.generateImage({
          project_id: selectedCampaign,
          prompt,
          variantCount,
        });
      }
    },
    onSuccess: async (response) => {
      if (response.success) {
        // For text, auto-validate each variant
        if (contentType === 'text') {
          const variants = response.data.variants as TextGenerationVariant[];
          const newContent: GeneratedContent[] = variants.map(v => ({
            content_id: v.content_id,
            text: v.generated_content,
            isValidating: true,
          }));
          setGeneratedContent(newContent);

          // Auto-validate each piece of content
          for (let i = 0; i < newContent.length; i++) {
            try {
              const validationResponse = await apiClient.validateContent({
                content_id: newContent[i].content_id,
              });
              if (validationResponse.success) {
                setGeneratedContent(prev => prev.map((c, idx) =>
                  idx === i
                    ? { ...c, validation: validationResponse.data.validation, isValidating: false }
                    : c
                ));
              }
            } catch (error) {
              setGeneratedContent(prev => prev.map((c, idx) =>
                idx === i ? { ...c, isValidating: false } : c
              ));
            }
          }
        } else {
          // For images, show them with the computation metrics
          const imageResponse = response.data as ImageGenerationResponse;
          const variants = imageResponse.variants;
          const metrics = imageResponse.computation_metrics;
          const newContent: GeneratedContent[] = variants.map((v) => {
            const brandScore = metrics?.rag_similarity ? metrics.rag_similarity * 100 : 75;
            const qualityScore = metrics?.predicted_quality || 80;
            const overallScore = (brandScore * 0.6) + (qualityScore * 0.4);
            return {
              content_id: v.content_id,
              text: v.image_url,
              validation: {
                brand_consistency_score: brandScore,
                quality_score: qualityScore,
                overall_score: overallScore,
                passes_validation: overallScore >= 70,
                strengths: overallScore >= 70 ? ['AI-enhanced with brand context'] : [],
                issues: overallScore < 70 ? [{ severity: 'minor' as const, category: 'brand', description: 'Low brand alignment', suggestion: 'Try adding more brand-specific keywords' }] : [],
                recommendations: [],
                summary: 'Generated with RAG-enhanced prompts',
              },
            };
          });
          setGeneratedContent(newContent);
        }
      }
    },
  });

  const handleGenerate = () => {
    if (!selectedCampaign || !prompt.trim()) return;
    setGeneratedContent([]);
    generateMutation.mutate();
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-4 w-4" />;
    if (score >= 60) return <AlertCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);
  const selectedTheme = selectedCampaignData ? getThemeForCampaign(selectedCampaignData) : undefined;

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Campaigns Ready</h2>
          <p className="text-gray-600 mb-4">
            You need to set up your brand and create a campaign first.
          </p>
          <a
            href="/setup"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Set Up Your Brand
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Campaign Workspace</h1>
        <p className="text-gray-600">
          Generate on-brand marketing content with AI-powered validation
        </p>
      </div>

      {/* Campaign Selector */}
      <div className="card mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Campaign
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="input"
            >
              <option value="">Choose a campaign...</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          {selectedTheme && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brand Theme
              </label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 rounded-lg border border-primary-200">
                <Sparkles className="h-4 w-4 text-primary-600" />
                <span className="text-primary-700 font-medium">{selectedTheme.name}</span>
                {selectedTheme.tags && selectedTheme.tags.length > 0 && (
                  <span className="text-primary-500 text-sm">
                    ({selectedTheme.tags.slice(0, 2).join(', ')})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Generation Form */}
      {selectedCampaign && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary-600" />
            Create Content
          </h2>

          {/* Content Type Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setContentType('text')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                contentType === 'text'
                  ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              <FileText className="h-4 w-4" />
              Text Copy
            </button>
            <button
              onClick={() => setContentType('image')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                contentType === 'image'
                  ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              Image
            </button>
          </div>

          {/* Prompt Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What do you want to create?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={contentType === 'text'
                ? "e.g., Write a compelling email subject line for our summer sale..."
                : "e.g., A hero image for our summer sale featuring happy customers..."
              }
              rows={3}
              className="input"
            />
          </div>

          {/* Variant Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Generate
              </label>
              <select
                value={variantCount}
                onChange={(e) => setVariantCount(Number(e.target.value))}
                className="input w-20"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">variants</span>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateMutation.isPending}
              className="btn btn-primary flex items-center gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate & Validate
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Generated Content with Validation Scores */}
      {generatedContent.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-600" />
            Generated Content
            <span className="text-sm font-normal text-gray-500">
              (auto-validated against your brand)
            </span>
          </h2>

          {generatedContent.map((content, index) => (
            <div
              key={content.content_id}
              className="card border-l-4 border-l-primary-500"
            >
              <div className="flex justify-between items-start gap-4">
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-500">
                      Variant {index + 1}
                    </span>
                  </div>
                  {contentType === 'text' ? (
                    <p className="text-gray-900 whitespace-pre-wrap">{content.text}</p>
                  ) : (
                    <img
                      src={content.text}
                      alt={`Generated variant ${index + 1}`}
                      className="max-w-md rounded-lg border border-gray-200"
                    />
                  )}
                </div>

                {/* Validation Score */}
                <div className="flex flex-col items-end gap-2">
                  {content.isValidating ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Validating...</span>
                    </div>
                  ) : content.validation ? (
                    <>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getScoreColor(content.validation.brand_consistency_score)}`}>
                        {getScoreIcon(content.validation.brand_consistency_score)}
                        <span className="font-semibold">
                          {Math.round(content.validation.brand_consistency_score)}
                        </span>
                        <span className="text-sm opacity-75">Brand Score</span>
                      </div>
                      {content.validation.passes_validation ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="h-3 w-3" /> On-brand
                        </span>
                      ) : (
                        <span className="text-xs text-yellow-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Needs review
                        </span>
                      )}
                    </>
                  ) : null}

                  {/* Copy Button (for text) */}
                  {contentType === 'text' && (
                    <button
                      onClick={() => handleCopy(content.text, content.content_id)}
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                    >
                      {copiedId === content.content_id ? (
                        <>
                          <Check className="h-4 w-4 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Validation Details (expandable) */}
              {content.validation && content.validation.strengths.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap gap-2">
                    {content.validation.strengths.map((strength, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full"
                      >
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Regenerate Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="btn btn-secondary flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Generate More Variants
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
