import { useState } from 'react';
import type { Content, ValidationResult } from '../types';
import { apiClient } from '../services/api';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Download, Copy } from 'lucide-react';

interface LinkedInPreviewProps {
  textContent: Content;
  imageContent?: Content;
  createdAt?: string;
  onRegenerate?: () => Promise<void> | void;
  showHeaderActions?: boolean;
}

export default function LinkedInPreview({
  textContent,
  imageContent,
  createdAt,
  onRegenerate,
  showHeaderActions = true,
}: LinkedInPreviewProps) {
  const displayDate = createdAt 
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Just now';

  const [showValidation, setShowValidation] = useState(false);
  const [textValidation, setTextValidation] = useState<ValidationResult | null>(null);
  const [imageValidation, setImageValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const isPoorQuality = (validation: ValidationResult | null) => {
    return !!validation && validation.overall_score < 70;
  };

  const handleValidate = async () => {
    if (!textContent.id && !imageContent?.id) return;
    setShowValidation(true);
    setIsValidating(true);
    try {
      if (textContent.id) {
        const res = await apiClient.validateContent({ content_id: textContent.id });
        if (res.data?.validation) {
          setTextValidation(res.data.validation);
        }
      }
      if (imageContent?.id) {
        const res = await apiClient.validateContent({ content_id: imageContent.id });
        if (res.data?.validation) {
          setImageValidation(res.data.validation);
        }
      }
    } catch (err) {
      console.error('Failed to validate content', err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyCaption = async () => {
    const text = (captionText || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy caption', err);
    }
  };

  // Extract hashtags from text content (simple extraction - look for #hashtag patterns)
  // IMPORTANT: Only extract from textContent, NEVER from imageContent (which has overlay text)
  const extractHashtags = (text: string): string[] => {
    if (!text || !text.trim()) return [];
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(m => m.replace('#', '')) : [];
  };

  // Only use textContent for hashtags - imageContent.text_content is overlay/prompt text
  const hashtags = extractHashtags(textContent.text_content || '');
  
  // Ensure we never display image's text_content (it's overlay/prompt text)
  const captionText = textContent.text_content || '';

  const containerClasses = [
    'bg-white border border-gray-200 rounded-lg overflow-hidden transition-all duration-300',
  ].join(' ');

  return (
    <div className={containerClasses}>
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h3 className="font-medium text-gray-900 text-sm">LinkedIn Preview</h3>
        {showHeaderActions && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={!onRegenerate || isRegenerating}
              className="px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
            >
              {isRegenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span>Regenerate</span>
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating}
              className="px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
            >
              {isValidating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              )}
              <span>Validate</span>
            </button>
          </div>
        )}
      </div>
      <div className="p-4">
        {/* Validation panel - above LinkedIn post content */}
        {showValidation && (textValidation || imageValidation || isValidating) && (
          <div className="mb-4 rounded-md border border-gray-100 bg-gray-50 p-3 space-y-3">
            {isValidating && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Validating content...
              </div>
            )}

            {textValidation && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Caption</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Brand</p>
                    <p className={`font-semibold ${getScoreColor(textValidation.brand_consistency_score)}`}>
                      {textValidation.brand_consistency_score}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quality</p>
                    <p className={`font-semibold ${getScoreColor(textValidation.quality_score)}`}>
                      {textValidation.quality_score}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Overall</p>
                    <p className={`font-semibold ${getScoreColor(textValidation.overall_score)}`}>
                      {textValidation.overall_score}
                    </p>
                  </div>
                </div>
                <div className={`p-2 rounded ${getScoreBgColor(textValidation.overall_score)}`}>
                  <div className="flex items-start gap-2">
                    {textValidation.passes_validation ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <p className="text-[11px] text-gray-700">{textValidation.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {imageValidation && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Image</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Brand</p>
                    <p className={`font-semibold ${getScoreColor(imageValidation.brand_consistency_score)}`}>
                      {imageValidation.brand_consistency_score}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quality</p>
                    <p className={`font-semibold ${getScoreColor(imageValidation.quality_score)}`}>
                      {imageValidation.quality_score}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Overall</p>
                    <p className={`font-semibold ${getScoreColor(imageValidation.overall_score)}`}>
                      {imageValidation.overall_score}
                    </p>
                  </div>
                </div>
                <div className={`p-2 rounded ${getScoreBgColor(imageValidation.overall_score)}`}>
                  <div className="flex items-start gap-2">
                    {imageValidation.passes_validation ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <p className="text-[11px] text-gray-700">{imageValidation.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {isPoorQuality(textValidation) || isPoorQuality(imageValidation) ? (
              <p className="text-[11px] text-red-600">
                Scores are below our recommended threshold. Consider regenerating this post to improve alignment.
              </p>
            ) : null}
          </div>
        )}

        {/* Fake LinkedIn post header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-gray-300 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900">Your Name</p>
              <p className="text-xs text-gray-500">Your headline here</p>
              <p className="text-xs text-gray-400">{displayDate} · 🌐</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCaption}
            disabled={!captionText || !captionText.trim()}
            className="ml-2 inline-flex items-center justify-center rounded-full p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            title={copied ? 'Copied!' : 'Copy caption'}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        
        {/* Post content - caption and image together in same container */}
        {/* Post caption - only show if there's actual caption text */}
        {captionText && captionText.trim() && (
          <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">
            {captionText}
          </div>
        )}
        
        {/* Post image - directly below caption, no separate container */}
        {imageContent?.media_url && (
          <div className="-mx-4 mb-3 relative group">
            <img
              src={imageContent.media_url}
              alt="Post image"
              className="w-full"
            />
            <a
              href={imageContent.media_url}
              download="linkedin-post-image.png"
              className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-black/60 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Download image"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
        
        {/* Hashtags - show after image if present, otherwise after text */}
        {hashtags.length > 0 && (
          <div className="mt-3 text-sm text-blue-600">
            {hashtags.map(h => `#${h}`).join(' ')}
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
  );
}

