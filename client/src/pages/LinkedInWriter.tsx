import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import {
  Loader2,
  Send,
  Save,
  Trash2,
  Hash,
  Clock,
  Copy,
  Check,
  FileText,
  Sparkles,
  Image,
  Download,
  RefreshCw
} from 'lucide-react';

interface Draft {
  id: string;
  topic: string;
  content: string;
  projectId: string;
  createdAt: string;
  hashtags: string[];
  imageUrl?: string;
}

const LINKEDIN_CHAR_LIMIT = 3000;
const LINKEDIN_OPTIMAL_LENGTH = 1300; // Optimal for engagement

export default function LinkedInWriter() {
  const [searchParams] = useSearchParams();
  const campaignIdParam = searchParams.get('campaign_id');
  
  const [topic, setTopic] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(campaignIdParam || '');
  const [generatedContent, setGeneratedContent] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [copied, setCopied] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [includeImage, setIncludeImage] = useState(true);

  // Load drafts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('linkedin_drafts');
    if (saved) {
      setDrafts(JSON.parse(saved));
    }
  }, []);

  // Pre-fill campaign from URL parameter
  useEffect(() => {
    if (campaignIdParam) {
      setSelectedProjectId(campaignIdParam);
    }
  }, [campaignIdParam]);

  // Save drafts to localStorage
  const saveDrafts = (newDrafts: Draft[]) => {
    setDrafts(newDrafts);
    localStorage.setItem('linkedin_drafts', JSON.stringify(newDrafts));
  };

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const projects = projectsData?.data?.filter(p => p.theme_id) || [];
  const themes = themesData?.data || [];
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedTheme = themes.find(t => t.id === selectedProject?.theme_id);

  // Generate LinkedIn post using Ditto API
  const generatePost = useMutation({
    mutationFn: async () => {
      // Generate post text content
      const response = await apiClient.generateText({
        project_id: selectedProjectId,
        prompt: `Write a professional LinkedIn post about: ${topic}.
          Make it engaging, authentic, and suitable for a professional audience.
          Include a hook in the first line to grab attention.
          Use short paragraphs and line breaks for readability.
          Keep it under ${LINKEDIN_OPTIMAL_LENGTH} characters for optimal engagement.
          Do not include hashtags in the post - they will be added separately.`,
        variantCount: 1,
      });

      const content = response.data?.variants?.[0]?.generated_content || '';
      setGeneratedContent(content);

      // Generate relevant hashtags
      generateHashtags(topic);

      // Generate image if enabled
      if (includeImage) {
        try {
          // First, generate a catchy headline/quote for the image overlay
          const headlineResponse = await apiClient.generateText({
            project_id: selectedProjectId,
            prompt: `Write a single powerful, quotable headline (max 10 words) about: ${topic}.
              This will be overlaid on a LinkedIn post image.
              Make it punchy, memorable, and shareable.
              Do not use quotes or punctuation at the start/end.
              Just return the headline text, nothing else.`,
            variantCount: 1,
          });

          const overlayText = headlineResponse.data?.variants?.[0]?.generated_content?.trim() || '';

          // Generate image with the AI-generated overlay text
          const imageResponse = await apiClient.generateImage({
            project_id: selectedProjectId,
            prompt: `Professional LinkedIn post image about: ${topic}.
              Clean, modern, business-appropriate visual.
              High quality, engaging, suitable for professional social media.`,
            variantCount: 1,
            aspectRatio: '1:1',
            overlay_text: overlayText,
          });

          const imageUrl = imageResponse.data?.variants?.[0]?.image_url;
          if (imageUrl) {
            setGeneratedImageUrl(imageUrl);
          }
        } catch (e) {
          console.error('Failed to generate image:', e);
          // Continue without image - text is more important
        }
      }

      return content;
    },
  });

  // Regenerate just the image with new overlay text
  const regenerateImage = useMutation({
    mutationFn: async () => {
      // Generate new headline for overlay
      const headlineResponse = await apiClient.generateText({
        project_id: selectedProjectId,
        prompt: `Write a single powerful, quotable headline (max 10 words) about: ${topic}.
          This will be overlaid on a LinkedIn post image.
          Make it punchy, memorable, and shareable.
          Do not use quotes or punctuation at the start/end.
          Just return the headline text, nothing else.`,
        variantCount: 1,
      });

      const overlayText = headlineResponse.data?.variants?.[0]?.generated_content?.trim() || '';

      const imageResponse = await apiClient.generateImage({
        project_id: selectedProjectId,
        prompt: `Professional LinkedIn post image about: ${topic}.
          Clean, modern, business-appropriate visual.
          High quality, engaging, suitable for professional social media.`,
        variantCount: 1,
        aspectRatio: '1:1',
        overlay_text: overlayText,
      });

      const imageUrl = imageResponse.data?.variants?.[0]?.image_url;
      if (imageUrl) {
        setGeneratedImageUrl(imageUrl);
      }
      return imageUrl;
    },
  });

  // Generate hashtags based on topic
  const generateHashtags = (topic: string) => {
    // Extract keywords and create hashtags
    const words = topic.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const commonHashtags = ['linkedin', 'professional', 'career', 'business'];
    const topicHashtags = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1));

    const allHashtags = [...new Set([...topicHashtags, ...commonHashtags.slice(0, 2)])].slice(0, 5);
    setHashtags(allHashtags);
  };

  // Save current post as draft
  const saveDraft = () => {
    if (!generatedContent) return;

    const draft: Draft = {
      id: Date.now().toString(),
      topic,
      content: generatedContent,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
      hashtags,
      imageUrl: generatedImageUrl || undefined,
    };

    saveDrafts([draft, ...drafts]);
  };

  // Load a draft
  const loadDraft = (draft: Draft) => {
    setTopic(draft.topic);
    setGeneratedContent(draft.content);
    setSelectedProjectId(draft.projectId);
    setHashtags(draft.hashtags);
    setGeneratedImageUrl(draft.imageUrl || null);
    setShowDrafts(false);
  };

  // Delete a draft
  const deleteDraft = (id: string) => {
    saveDrafts(drafts.filter(d => d.id !== id));
  };

  // Copy post to clipboard
  const copyToClipboard = () => {
    const fullPost = `${generatedContent}\n\n${hashtags.map(h => `#${h}`).join(' ')}`;
    navigator.clipboard.writeText(fullPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add/remove hashtag
  const toggleHashtag = (tag: string) => {
    if (hashtags.includes(tag)) {
      setHashtags(hashtags.filter(h => h !== tag));
    } else if (hashtags.length < 5) {
      setHashtags([...hashtags, tag]);
    }
  };

  const charCount = generatedContent.length;
  const isOverLimit = charCount > LINKEDIN_CHAR_LIMIT;
  const isOptimalLength = charCount > 0 && charCount <= LINKEDIN_OPTIMAL_LENGTH;

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Send className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">LinkedIn Post Writer</h1>
        </div>
        <p className="text-gray-500">
          Create engaging LinkedIn posts powered by your brand voice
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Input */}
        <div className="lg:col-span-2 space-y-6">
          {/* Topic Input */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What do you want to post about?
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Lessons learned from launching our new product, Tips for remote team management, Industry trends in 2025..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Campaign Selection - Mandatory */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a campaign...</option>
              {projects.map((project) => {
                const theme = themes.find(t => t.id === project.theme_id);
                return (
                  <option key={project.id} value={project.id}>
                    {project.name} {theme?.name ? `(${theme.name})` : ''}
                  </option>
                );
              })}
            </select>
            {selectedTheme && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {selectedTheme.tags?.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Image Option */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeImage}
                onChange={(e) => setIncludeImage(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Generate post image</span>
              </div>
              <span className="text-xs text-gray-400 ml-auto">Recommended for engagement</span>
            </label>
          </div>

          {/* Generate Button */}
          <button
            onClick={() => generatePost.mutate()}
            disabled={!topic.trim() || !selectedProjectId || generatePost.isPending}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            title={!selectedProjectId ? 'Please select a campaign first' : ''}
          >
            {generatePost.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating {includeImage ? 'post & image...' : 'post...'}
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate LinkedIn Post {includeImage && '& Image'}
              </>
            )}
          </button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Your Post</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isOverLimit ? 'text-red-500' : isOptimalLength ? 'text-green-500' : 'text-gray-500'}`}>
                    {charCount} / {LINKEDIN_CHAR_LIMIT}
                  </span>
                  {isOptimalLength && (
                    <span className="text-xs text-green-500 bg-green-50 px-2 py-1 rounded">
                      Optimal length
                    </span>
                  )}
                </div>
              </div>

              <textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-sans"
                rows={10}
              />

              {/* Hashtags */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">Hashtags</span>
                  <span className="text-xs text-gray-400">({hashtags.length}/5)</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {hashtags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleHashtag(tag)}
                      className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full hover:bg-blue-200 transition-colors"
                    >
                      #{tag} ×
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Add hashtag..."
                    className="px-3 py-1 border border-gray-200 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        toggleHashtag(e.currentTarget.value.trim().replace('#', ''));
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              {/* Generated Image */}
              {generatedImageUrl && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Post Image</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => regenerateImage.mutate()}
                        disabled={regenerateImage.isPending}
                        className="px-3 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                      >
                        {regenerateImage.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Regenerate
                      </button>
                      <a
                        href={generatedImageUrl}
                        download="linkedin-post-image.png"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    </div>
                  </div>
                  <img
                    src={generatedImageUrl}
                    alt="Generated LinkedIn post image"
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
                <button
                  onClick={saveDraft}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Preview & Drafts */}
        <div className="space-y-6">
          {/* LinkedIn Preview */}
          {generatedContent && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-medium text-gray-900 text-sm">LinkedIn Preview</h3>
              </div>
              <div className="p-4">
                {/* Fake LinkedIn post header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-300 rounded-full" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Your Name</p>
                    <p className="text-xs text-gray-500">Your headline here</p>
                    <p className="text-xs text-gray-400">Just now · 🌐</p>
                  </div>
                </div>
                {/* Post content preview */}
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {generatedContent.slice(0, 300)}
                  {generatedContent.length > 300 && (
                    <span className="text-gray-400">... see more</span>
                  )}
                </div>
                {/* Hashtags */}
                <div className="mt-3 text-sm text-blue-600">
                  {hashtags.map(h => `#${h}`).join(' ')}
                </div>
                {/* Post image preview */}
                {generatedImageUrl && (
                  <div className="mt-3 -mx-4">
                    <img
                      src={generatedImageUrl}
                      alt="Post image"
                      className="w-full"
                    />
                  </div>
                )}
                {/* Fake engagement bar */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                  <span>👍 Like</span>
                  <span>💬 Comment</span>
                  <span>🔄 Repost</span>
                  <span>📤 Send</span>
                </div>
              </div>
            </div>
          )}

          {/* Drafts */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDrafts(!showDrafts)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-900 text-sm">Saved Drafts</span>
                <span className="text-xs text-gray-400">({drafts.length})</span>
              </div>
              <span className="text-gray-400">{showDrafts ? '−' : '+'}</span>
            </button>

            {showDrafts && (
              <div className="border-t border-gray-100">
                {drafts.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">No drafts saved</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {drafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => loadDraft(draft)}
                            className="text-left flex-1"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {draft.topic}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {new Date(draft.createdAt).toLocaleDateString()}
                            </p>
                          </button>
                          <button
                            onClick={() => deleteDraft(draft.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 text-sm mb-2">LinkedIn Tips</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Hook readers in the first 2 lines</li>
              <li>• Use short paragraphs & line breaks</li>
              <li>• Optimal post length: 1,300 characters</li>
              <li>• Use 3-5 relevant hashtags</li>
              <li>• Post when your audience is active</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
