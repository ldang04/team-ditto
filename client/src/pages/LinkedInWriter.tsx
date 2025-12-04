import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import TiptapEditor from '../components/TiptapEditor';
import type { ValidationResult } from '../types';
import {
  Loader2,
  Copy,
  Check,
  Sparkles,
  Image,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Plus,
  Link,
  Wand2,
  Upload,
} from 'lucide-react';

const LINKEDIN_CHAR_LIMIT = 3000;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image';
  imageUrl?: string;
};

export default function LinkedInWriter() {
  const [searchParams] = useSearchParams();
  const campaignIdParam = searchParams.get('campaign_id');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Editor state
  const [postContent, setPostContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Campaign selection
  const [selectedProjectId, setSelectedProjectId] = useState(campaignIdParam || '');

  // Chat panel state
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I can help you write your LinkedIn post. Tell me what you want to write about, or ask me to generate an image.',
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Image input state
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url' | 'generate'>('upload');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | null>(null); // For uploaded images
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation state
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (campaignIdParam) {
      setSelectedProjectId(campaignIdParam);
    }
  }, [campaignIdParam]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  // Handle chat submit
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !selectedProjectId || isGenerating) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
    };
    setChatMessages(prev => [...prev, userMessage]);
    const prompt = chatInput;
    setChatInput('');
    setIsGenerating(true);

    // Detect if user wants an image
    const wantsImage = /image|picture|photo|visual|graphic|generate.*image|create.*image/i.test(prompt);

    try {
      if (wantsImage) {
        // Generate image
        let overlayText = '';
        if (postContent.trim()) {
          try {
            const headlineResponse = await apiClient.generateText({
              project_id: selectedProjectId,
              prompt: `Write a single powerful headline (max 8 words) for: "${postContent.slice(0, 300)}"`,
              variantCount: 1,
            });
            overlayText = headlineResponse.data?.variants?.[0]?.generated_content?.trim() || '';
          } catch (e) {
            console.error('Failed to generate headline:', e);
          }
        }

        const response = await apiClient.generateImage({
          project_id: selectedProjectId,
          prompt: prompt,
          variantCount: 1,
          aspectRatio: '1:1',
          overlay_text: overlayText,
        });

        const url = response.data?.variants?.[0]?.image_url;
        if (url) {
          setImageUrl(url);
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Here\'s your image! I\'ve added it to your post.',
            type: 'image',
            imageUrl: url,
          }]);
        }
      } else {
        // Generate text
        const response = await apiClient.generateText({
          project_id: selectedProjectId,
          prompt: `Write a professional LinkedIn post about: ${prompt}.
            Make it engaging and authentic. Use short paragraphs.
            Keep it under 1300 characters. No hashtags.`,
          variantCount: 1,
        });

        const content = response.data?.variants?.[0]?.generated_content || '';
        if (content) {
          setPostContent(content);
          setValidation(null);
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Done! I\'ve updated your post. Feel free to edit it, then validate when ready.',
            type: 'text',
          }]);
        }
      }
    } catch (err) {
      console.error('Generation failed:', err);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Validate current draft (text and/or image)
  const handleValidate = async () => {
    if (!selectedProjectId || (!postContent.trim() && !imageBase64)) return;

    setIsValidating(true);
    try {
      // Validate text if present
      if (postContent.trim()) {
        const textResponse = await apiClient.validateContent({
          content: postContent,
          project_id: selectedProjectId,
          media_type: 'text',
        });
        if (textResponse.data?.validation) {
          setValidation(textResponse.data.validation);
        }
      }

      // Validate uploaded image if present (uses multimodal embeddings)
      if (imageBase64) {
        const imageResponse = await apiClient.validateContent({
          image_base64: imageBase64,
          project_id: selectedProjectId,
        });
        // If we have both text and image, combine scores (average)
        if (postContent.trim() && imageResponse.data?.validation) {
          setValidation(prev => {
            if (!prev) return imageResponse.data!.validation;
            const imageVal = imageResponse.data!.validation;
            return {
              ...prev,
              brand_consistency_score: Math.round((prev.brand_consistency_score + imageVal.brand_consistency_score) / 2),
              overall_score: Math.round((prev.overall_score + imageVal.overall_score) / 2),
              passes_validation: prev.passes_validation && imageVal.passes_validation,
              summary: prev.passes_validation && imageVal.passes_validation
                ? 'Text and image align well with brand guidelines.'
                : 'Some content needs revision to better align with brand.',
            };
          });
        } else if (imageResponse.data?.validation) {
          setValidation(imageResponse.data.validation);
        }
      }
    } catch (err) {
      console.error('Failed to validate:', err);
    } finally {
      setIsValidating(false);
    }
  };

  // Generate image directly
  const handleGenerateImage = async () => {
    if (!selectedProjectId || isGeneratingImage) return;

    setIsGeneratingImage(true);
    try {
      let overlayText = '';
      if (postContent.trim()) {
        try {
          const headlineResponse = await apiClient.generateText({
            project_id: selectedProjectId,
            prompt: `Write a single powerful headline (max 8 words) for: "${postContent.slice(0, 300)}"`,
            variantCount: 1,
          });
          overlayText = headlineResponse.data?.variants?.[0]?.generated_content?.trim() || '';
        } catch (e) {
          console.error('Failed to generate headline:', e);
        }
      }

      const response = await apiClient.generateImage({
        project_id: selectedProjectId,
        prompt: imagePrompt || 'Professional LinkedIn post image. Clean, modern, business-appropriate.',
        variantCount: 1,
        aspectRatio: '1:1',
        overlay_text: overlayText,
      });

      const url = response.data?.variants?.[0]?.image_url;
      if (url) {
        setImageUrl(url);
        setShowImageInput(false);
        setImagePrompt('');
      }
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Add image from URL
  const handleAddImageUrl = () => {
    if (imageUrlInput.trim()) {
      setImageUrl(imageUrlInput.trim());
      setShowImageInput(false);
      setImageUrlInput('');
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create a local URL for preview
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setShowImageInput(false);
      setValidation(null);

      // Convert to base64 for validation
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:image/...;base64, prefix
        setImageBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(postContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = postContent.length;
  const isOverLimit = charCount > LINKEDIN_CHAR_LIMIT;

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex">
      {/* Main Document Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${chatOpen ? 'mr-80' : 'mr-0'}`}>
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setValidation(null);
              }}
              className="px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select campaign...</option>
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
              <div className="flex gap-1">
                {selectedTheme.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {charCount.toLocaleString()} / {LINKEDIN_CHAR_LIMIT.toLocaleString()}
            </span>

            <button
              onClick={copyToClipboard}
              disabled={!postContent.trim()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-40 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>

            <button
              onClick={handleValidate}
              disabled={!selectedProjectId || (!postContent.trim() && !imageBase64) || isValidating}
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Check
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="max-w-2xl mx-auto py-12 px-8">
            {/* Validation banner */}
            {validation && (
              <div className={`mb-6 p-4 rounded-lg border ${
                validation.passes_validation
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {validation.passes_validation ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className={`font-medium ${
                      validation.passes_validation ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {validation.passes_validation ? 'On Brand' : 'Needs Work'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${
                      validation.brand_consistency_score >= 80 ? 'text-green-600' :
                      validation.brand_consistency_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {validation.brand_consistency_score}
                    </span>
                    <span className="text-sm text-gray-500">/ 100</span>
                  </div>
                </div>
                {validation.summary && (
                  <p className="mt-2 text-sm text-gray-600">{validation.summary}</p>
                )}
                <button
                  onClick={() => setValidation(null)}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Editor card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {/* Image preview */}
              {imageUrl && (
                <div className="relative border-b border-gray-200">
                  <img
                    src={imageUrl}
                    alt="Post image"
                    className="w-full rounded-t-lg"
                  />
                  <button
                    onClick={() => { setImageUrl(null); setImageBase64(null); }}
                    className="absolute top-3 right-3 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Text editor */}
              <div className="p-8">
                <TiptapEditor
                  content={postContent}
                  onChange={(text) => {
                    setPostContent(text);
                    setValidation(null);
                  }}
                  placeholder="Start writing your LinkedIn post..."
                  editable={true}
                  className="min-h-[300px] text-lg leading-relaxed"
                />
              </div>

              {/* Add Image Section */}
              {!imageUrl && (
                <div className="border-t border-gray-200 p-6">
                  {!showImageInput ? (
                    <button
                      onClick={() => setShowImageInput(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-gray-300 hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Image
                    </button>
                  ) : (
                    <div className="space-y-4">
                      {/* Mode tabs */}
                      <div className="flex gap-2 border-b border-gray-200">
                        <button
                          onClick={() => setImageInputMode('upload')}
                          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            imageInputMode === 'upload'
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Upload className="h-4 w-4 inline mr-2" />
                          Upload
                        </button>
                        <button
                          onClick={() => setImageInputMode('url')}
                          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            imageInputMode === 'url'
                              ? 'border-blue-600 text-blue-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Link className="h-4 w-4 inline mr-2" />
                          URL
                        </button>
                        <button
                          onClick={() => setImageInputMode('generate')}
                          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            imageInputMode === 'generate'
                              ? 'border-purple-600 text-purple-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Wand2 className="h-4 w-4 inline mr-2" />
                          AI Generate
                        </button>
                      </div>

                      {imageInputMode === 'upload' ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">
                            Upload an image from your computer (JPG, PNG, GIF)
                          </p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex flex-col items-center justify-center gap-2"
                          >
                            <Upload className="h-8 w-8" />
                            <span className="text-sm font-medium">Click to upload</span>
                            <span className="text-xs text-gray-400">or drag and drop</span>
                          </button>
                        </div>
                      ) : imageInputMode === 'url' ? (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">
                            Paste a direct link to an image file
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              value={imageUrlInput}
                              onChange={(e) => setImageUrlInput(e.target.value)}
                              placeholder="https://example.com/image.jpg"
                              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleAddImageUrl}
                              disabled={!imageUrlInput.trim()}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500">
                            Describe what you want, or leave empty to auto-generate based on your post
                          </p>
                          <input
                            type="text"
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="e.g. A modern office with people collaborating"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <button
                            onClick={handleGenerateImage}
                            disabled={!selectedProjectId || isGeneratingImage}
                            className="w-full py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                          >
                            {isGeneratingImage ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4" />
                                Generate Image
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setShowImageInput(false);
                          setImageUrlInput('');
                          setImagePrompt('');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Empty state helper */}
            {!postContent && !imageUrl && (
              <div className="mt-8 text-center text-gray-400">
                <p className="text-sm">Start typing or use the AI assistant to get started</p>
                <button
                  onClick={() => setChatOpen(true)}
                  className="mt-2 text-blue-600 text-sm hover:underline"
                >
                  Open AI Assistant →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Chat Panel */}
      <div className={`fixed right-0 top-[73px] bottom-0 w-80 bg-white border-l border-gray-200 flex flex-col transition-transform duration-300 ${chatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-gray-900">AI Assistant</span>
          </div>
          <button
            onClick={() => setChatOpen(false)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.content}
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="Generated"
                    className="mt-2 rounded-md max-w-full"
                  />
                )}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div className="p-4 border-t border-gray-200">
          {!selectedProjectId ? (
            <p className="text-sm text-gray-500 text-center">
              Select a campaign to use AI
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                placeholder="Write about... or generate image..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isGenerating}
              />
              <button
                onClick={handleChatSubmit}
                disabled={!chatInput.trim() || isGenerating}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setChatInput('Write a post about ')}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              <MessageSquare className="h-3 w-3 inline mr-1" />
              Write post
            </button>
            <button
              onClick={() => setChatInput('Generate an image for ')}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              <Image className="h-3 w-3 inline mr-1" />
              Add image
            </button>
          </div>
        </div>
      </div>

      {/* Toggle button when chat is closed */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed right-4 bottom-4 p-3 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
