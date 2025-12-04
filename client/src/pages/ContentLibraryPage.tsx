import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Library, FileText, Image as ImageIcon, Search, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Content } from '../types';

export default function ContentLibraryPage() {
  const [searchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project_id');

  const [selectedProjectId, setSelectedProjectId] = useState(projectIdParam || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'text' | 'image'>('all');

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: allProjectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const projects = projectsData?.data || [];
  const allProjects = allProjectsData?.data || [];

  // Fetch content for selected project
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['content', selectedProjectId],
    queryFn: () => {
      if (selectedProjectId === 'all') {
        // Fetch content for all projects
        return Promise.all(
          allProjects.map((p) =>
            apiClient.getContent(p.id!).then((res) => ({
              projectId: p.id,
              projectName: p.name,
              contents: res.data || [],
            }))
          )
        ).then((results) => ({
          success: true,
          data: results.flatMap((r) =>
            r.contents.map((c) => ({ ...c, _projectName: r.projectName, _projectId: r.projectId }))
          ),
          message: '',
        }));
      }
      return apiClient.getContent(selectedProjectId);
    },
    enabled: selectedProjectId !== '' && (selectedProjectId === 'all' ? allProjects.length > 0 : true),
  });

  const contents = contentData?.data || [];

  // Filter content
  const filteredContents = contents.filter((content: Content & { _projectName?: string }) => {
    const matchesSearch =
      searchQuery === '' ||
      content.text_content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content._projectName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMediaType =
      mediaTypeFilter === 'all' || content.media_type === mediaTypeFilter;
    return matchesSearch && matchesMediaType;
  });

  useEffect(() => {
    if (projectIdParam) {
      setSelectedProjectId(projectIdParam);
    }
  }, [projectIdParam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Library</h1>
        <p className="text-gray-600 mt-2">Browse and manage all generated content</p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="input"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Media Type
            </label>
            <select
              value={mediaTypeFilter}
              onChange={(e) => setMediaTypeFilter(e.target.value as 'all' | 'text' | 'image')}
              className="input"
            >
              <option value="all">All Types</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search content..."
                className="input pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {contentLoading ? (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
        </div>
      ) : filteredContents.length === 0 ? (
        <div className="card text-center py-12">
          <Library className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No content found
          </h3>
          <p className="text-gray-600 mb-6">
            {selectedProjectId === 'all'
              ? 'No content has been generated yet'
              : 'No content matches your filters'}
          </p>
          <Link to="/generate/text" className="btn btn-primary">
            Generate Content
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredContents.length} content item(s)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContents.map((content: Content & { _projectName?: string; _projectId?: string }) => (
              <div key={content.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className={`p-2 rounded-lg ${
                      content.media_type === 'text' ? 'bg-green-100' : 'bg-pink-100'
                    }`}
                  >
                    {content.media_type === 'text' ? (
                      <FileText className="h-5 w-5 text-green-600" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-pink-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 uppercase">
                        {content.media_type}
                      </span>
                      {content._projectName && (
                        <span className="text-xs text-gray-400">•</span>
                      )}
                      {content._projectName && (
                        <Link
                          to={`/campaigns/${content._projectId}`}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          {content._projectName}
                        </Link>
                      )}
                    </div>
                    {content.created_at && (
                      <p className="text-xs text-gray-500">
                        {new Date(content.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>

                {content.media_type === 'text' ? (
                  <div className="mb-4">
                    <p className="text-sm text-gray-700 line-clamp-4">
                      {content.text_content}
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    {content.media_url && (
                      <img
                        src={content.media_url}
                        alt="Generated content"
                        className="w-full rounded-lg border border-gray-200 mb-2"
                      />
                    )}
                    {content.text_content && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {content.text_content}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    to={`/validate?content_id=${content.id}`}
                    className="btn btn-secondary text-sm flex-1 text-center"
                  >
                    Validate
                  </Link>
                  {content._projectId && (
                    <Link
                      to={`/campaigns/${content._projectId}`}
                      className="btn btn-secondary text-sm flex-1 text-center"
                    >
                      View Campaign
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

