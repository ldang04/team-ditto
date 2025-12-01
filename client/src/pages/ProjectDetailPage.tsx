import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { ArrowLeft, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import type { Project, Content } from '../types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();

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
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Project not found</h3>
        <Link to="/projects" className="text-primary-600 hover:text-primary-700">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const textContents = contents.filter((c: Content) => c.media_type === 'text');
  const imageContents = contents.filter((c: Content) => c.media_type === 'image');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/projects"
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mt-2">{project.description}</p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to={`/generate/text?project_id=${project.id}`}
              className="flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
            >
              <FileText className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Generate Text Content</span>
            </Link>
            <Link
              to={`/generate/image?project_id=${project.id}`}
              className="flex items-center gap-3 p-3 bg-pink-50 hover:bg-pink-100 rounded-lg transition-colors"
            >
              <ImageIcon className="h-5 w-5 text-pink-600" />
              <span className="font-medium text-gray-900">Generate Images</span>
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
              <p className="text-2xl font-bold text-gray-900">{contents.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Content */}
      {contentLoading ? (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
        </div>
      ) : contents.length > 0 ? (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Content</h2>
          <div className="space-y-4">
            {contents.slice(0, 10).map((content: Content) => (
              <div key={content.id} className="card">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    content.media_type === 'text' ? 'bg-green-100' : 'bg-pink-100'
                  }`}>
                    {content.media_type === 'text' ? (
                      <FileText className="h-5 w-5 text-green-600" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-pink-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {content.media_type}
                      </span>
                      {content.created_at && (
                        <span className="text-xs text-gray-500">
                          {new Date(content.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {content.media_type === 'text' ? (
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {content.text_content}
                      </p>
                    ) : (
                      <div>
                        {content.media_url && (
                          <img
                            src={content.media_url}
                            alt="Generated content"
                            className="max-w-xs rounded-lg mb-2"
                          />
                        )}
                        {content.text_content && (
                          <p className="text-xs text-gray-600">{content.text_content}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {contents.length > 10 && (
            <Link
              to={`/content?project_id=${project.id}`}
              className="block text-center text-primary-600 hover:text-primary-700 mt-4"
            >
              View all content →
            </Link>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No content yet
          </h3>
          <p className="text-gray-600 mb-6">
            Start generating content for this project
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to={`/generate/text?project_id=${project.id}`}
              className="btn btn-primary"
            >
              Generate Text
            </Link>
            <Link
              to={`/generate/image?project_id=${project.id}`}
              className="btn btn-secondary"
            >
              Generate Images
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

