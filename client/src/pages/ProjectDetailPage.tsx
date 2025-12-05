import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { ArrowLeft, FileText, Image as ImageIcon, Loader2, Send } from 'lucide-react';
import type { Project, Content } from '../types';
import LinkedInPreview from '../components/LinkedInPreview';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => apiClient.getProjects(),
    enabled: !!id,
    select: (data) => {
      const projects = data.data || [];
      return projects.find((p) => p.id === id);
    },
  });

  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['content', id],
    queryFn: () => apiClient.getContent(id!),
    enabled: !!id,
  });

  const project = projectData as Project | undefined;
  const contents = contentData?.data || [];

  // Helper function to identify overlay text items
  // Overlay text is short text content created right before an image
  const isOverlayText = (textContent: Content, imageContents: Content[]): boolean => {
    const OVERLAY_TEXT_THRESHOLD_MS = 15 * 1000; // 15 seconds
    const OVERLAY_TEXT_MAX_WORDS = 15; // Overlay text is typically short
    
    const textTime = textContent.created_at ? new Date(textContent.created_at).getTime() : 0;
    const textWordCount = (textContent.text_content || '').trim().split(/\s+/).length;
    
    // Check if this text was created right before an image (likely overlay text)
    return imageContents.some(imageContent => {
      if (!imageContent.created_at) return false;
      const imageTime = new Date(imageContent.created_at).getTime();
      const timeDiff = imageTime - textTime;
      // Overlay text is created BEFORE the image, within a short time window
      return timeDiff > 0 && timeDiff <= OVERLAY_TEXT_THRESHOLD_MS && textWordCount <= OVERLAY_TEXT_MAX_WORDS;
    });
  };

  if (projectLoading) {
    return (
      <div className="card text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card text-center py-12">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaign not found</h3>
        <Link to="/" className="text-primary-600 hover:text-primary-700">
          ← Back to Campaigns
        </Link>
      </div>
    );
  }

  // Group content by time windows (content created within 5 minutes of each other)
  const groupContentByTimeWindow = (contents: Content[]): Array<{ text: Content; image?: Content; createdAt: string }> => {
    const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
    
    if (contents.length === 0) return [];

    // Separate text and images
    const textContents = contents.filter(c => c.media_type === 'text');
    const imageContents = contents.filter(c => c.media_type === 'image');
    
    // Filter out overlay text items - these are short text items created right before an image
    // Overlay text is generated separately and should not appear as a standalone preview
    const filteredTextContents = textContents.filter(textContent => 
      !isOverlayText(textContent, imageContents)
    );
    
    const groups: Array<{ text: Content; image?: Content; createdAt: string }> = [];
    const usedImageIds = new Set<string>();

    // First, try to pair each text with a matching image
    // Use filteredTextContents to exclude overlay text items
    for (const textContent of filteredTextContents) {
      const textTime = textContent.created_at ? new Date(textContent.created_at).getTime() : 0;
      
      // Find the closest matching image within time window
      let bestMatch: Content | null = null;
      let bestTimeDiff = Infinity;
      
      for (const imageContent of imageContents) {
        if (usedImageIds.has(imageContent.id!)) continue;
        if (!imageContent.created_at) continue;
        
        const imageTime = new Date(imageContent.created_at).getTime();
        const timeDiff = Math.abs(imageTime - textTime);
        
        if (timeDiff <= TIME_WINDOW_MS && timeDiff < bestTimeDiff) {
          bestMatch = imageContent;
          bestTimeDiff = timeDiff;
        }
      }
      
      if (bestMatch) {
        // Found a match - pair them together
        usedImageIds.add(bestMatch.id!);
        groups.push({
          text: textContent,
          image: {
            ...bestMatch,
            text_content: '', // Clear image's text_content - it's overlay/prompt text, not caption
          },
          createdAt: textContent.created_at || bestMatch.created_at || '',
        });
      } else {
        // No matching image - standalone text post
        groups.push({
          text: textContent,
          createdAt: textContent.created_at || '',
        });
      }
    }
    
    // Add any remaining standalone images
    for (const imageContent of imageContents) {
      if (!usedImageIds.has(imageContent.id!)) {
        groups.push({
          text: {
            id: `placeholder-${imageContent.id}`,
            project_id: imageContent.project_id,
            media_type: 'text',
            media_url: 'text',
            text_content: '', // Empty - image-only post
          },
          image: {
            ...imageContent,
            text_content: '', // Clear image's text_content
          },
          createdAt: imageContent.created_at || '',
        });
      }
    }

    // Sort groups by creation time (newest first)
    return groups.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  };

  // Separate and filter content for counting and grouping
  const allTextContents = contents.filter((c: Content) => c.media_type === 'text');
  const allImageContents = contents.filter((c: Content) => c.media_type === 'image');
  
  // Filter out overlay text items for accurate counts
  const textContents = allTextContents.filter(textContent => 
    !isOverlayText(textContent, allImageContents)
  );
  const imageContents = allImageContents;
  
  const groupedContent = groupContentByTimeWindow(contents);

  // Regenerate an entire post (text + image) for a given group
  const handleRegeneratePost = async (group: { text: Content; image?: Content }) => {
    if (!project?.id) return;

    const basePrompt =
      group.text.prompt ||
      (group.text.text_content
        ? `Rewrite this LinkedIn post in a fresh way while keeping the same intent:\n\n${group.text.text_content}`
        : `Write a professional LinkedIn post for the campaign "${project.name}".`);

    // Regenerate text
    const textResponse = await apiClient.generateText({
      project_id: project.id,
      prompt: basePrompt,
      variantCount: 1,
    });

    const textVariant = textResponse.data?.variants?.[0];

    // Regenerate image
    try {
      const headlineResponse = await apiClient.generateText({
        project_id: project.id,
        prompt: `Write a single powerful, quotable headline (max 10 words) for a LinkedIn image for this post:\n\n${textVariant?.generated_content || group.text.text_content}`,
        variantCount: 1,
      });

      const overlayText =
        headlineResponse.data?.variants?.[0]?.generated_content?.trim() || '';

      await apiClient.generateImage({
        project_id: project.id,
        prompt: `Professional LinkedIn post image for the campaign "${project.name}". Clean, modern, business-appropriate visual. High quality, engaging, suitable for professional social media.`,
        variantCount: 1,
        aspectRatio: '1:1',
        overlay_text: overlayText,
      });
    } catch (e) {
      console.error('Failed to regenerate image for post:', e);
    }

    // Refresh content list so the new post appears
    await queryClient.invalidateQueries({ queryKey: ['content', id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link
          to="/"
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="text-gray-500 mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Project Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Details</h2>
          <div className="space-y-3">
            {project.goals && (
              <div>
                <span className="text-sm font-medium text-gray-500">Goals:</span>
                <p className="text-gray-900 mt-1">{project.goals}</p>
              </div>
            )}
            {project.customer_type && (
              <div>
                <span className="text-sm font-medium text-gray-500">Target Audience:</span>
                <p className="text-gray-900 mt-1">{project.customer_type}</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
          <div className="space-y-3">
            <Link
              to={`/create?campaign_id=${project.id}`}
              className="flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Send className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Create LinkedIn Post</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Text Content</p>
              <p className="text-2xl font-bold text-gray-900">{textContents.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-pink-100 p-3 rounded-lg">
              <ImageIcon className="h-6 w-6 text-pink-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Images</p>
              <p className="text-2xl font-bold text-gray-900">{imageContents.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Content</p>
              <p className="text-2xl font-bold text-gray-900">{textContents.length + imageContents.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* LinkedIn Drafts */}
      {contentLoading ? (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
        </div>
      ) : groupedContent.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">LinkedIn Drafts</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {groupedContent.map((group, index) => (
              <LinkedInPreview
                key={group.text.id || `group-${index}`}
                textContent={group.text}
                imageContent={group.image}
                createdAt={group.createdAt}
                onRegenerate={() => handleRegeneratePost(group)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No drafts yet
          </h3>
          <p className="text-gray-600 mb-6">
            Start creating LinkedIn posts for this campaign
          </p>
          <Link
            to={`/create?campaign_id=${project.id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Send className="h-5 w-5" />
            Create LinkedIn Post
          </Link>
        </div>
      )}
    </div>
  );
}

