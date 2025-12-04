import type { Content } from '../types';

interface LinkedInPreviewProps {
  textContent: Content;
  imageContent?: Content;
  createdAt?: string;
}

export default function LinkedInPreview({ textContent, imageContent, createdAt }: LinkedInPreviewProps) {
  const displayDate = createdAt 
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Just now';

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

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-medium text-gray-900 text-sm">LinkedIn Preview</h3>
      </div>
      <div className="p-4">
        {/* Fake LinkedIn post header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 bg-gray-300 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900">Your Name</p>
            <p className="text-xs text-gray-500">Your headline here</p>
            <p className="text-xs text-gray-400">{displayDate} · 🌐</p>
          </div>
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
          <div className="-mx-4 mb-3">
            <img
              src={imageContent.media_url}
              alt="Post image"
              className="w-full"
            />
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

