import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Palette,
  FileText,
  Image as ImageIcon,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export default function Dashboard() {
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const projects = projectsData?.data || [];
  const themes = themesData?.data || [];

  const stats = [
    {
      name: 'Projects',
      value: projects.length,
      icon: FolderKanban,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      href: '/projects',
    },
    {
      name: 'Themes',
      value: themes.length,
      icon: Palette,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/themes',
    },
  ];

  const quickActions = [
    {
      name: 'Create Text Content',
      description: 'Generate AI-powered text content',
      icon: FileText,
      href: '/generate/text',
      color: 'bg-green-500',
    },
    {
      name: 'Create Images',
      description: 'Generate branded images with AI',
      icon: ImageIcon,
      href: '/generate/image',
      color: 'bg-pink-500',
    },
    {
      name: 'Validate Content',
      description: 'Check content against brand guidelines',
      icon: TrendingUp,
      href: '/validate',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to BrandForge Studio</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.name}
              to={stat.href}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-4 rounded-lg`}>
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.name}
                to={action.href}
                className="card hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <div className={`${action.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {action.name}
                </h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Projects</h2>
            <Link
              to="/projects"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <FolderKanban className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <div className="card text-center py-12">
          <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Get Started
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first theme and project to start generating content
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/themes" className="btn btn-primary">
              Create Theme
            </Link>
            <Link to="/projects" className="btn btn-secondary">
              Create Project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

