import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Plus, Loader2, ArrowRight } from 'lucide-react';

export default function CampaignsDashboard() {
  const queryClient = useQueryClient();
  const { clientName } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.getProjects(),
  });

  const { data: themesData, isLoading: loadingThemes } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createProject({
      name,
      theme_id: selectedCompanyId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowForm(false);
      setName('');
      setSelectedCompanyId('');
    },
  });

  const campaigns = projectsData?.data || [];
  const companies = themesData?.data || [];
  const hasCompanies = companies.length > 0;

  if (loadingProjects || loadingThemes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // No companies - need to set up first
  if (!hasCompanies) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Welcome{clientName ? `, ${clientName}` : ''}
        </h1>
        <p className="text-gray-500 mb-8">
          Set up your company to start creating content.
        </p>
        <Link
          to="/setup"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-gray-500">Your marketing campaigns</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {/* New Campaign Form */}
      {showForm && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h2 className="font-medium text-gray-900 mb-4">New Campaign</h2>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Sale, Product Launch..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Company</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                required
              >
                <option value="">Select company...</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!name || !selectedCompanyId || createMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">No campaigns yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="text-gray-900 font-medium hover:underline"
          >
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => {
            const company = companies.find(c => c.id === campaign.theme_id);
            return (
              <Link
                key={campaign.id}
                to="/generate"
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{campaign.name}</h3>
                    {company && (
                      <p className="text-sm text-gray-500">{company.name}</p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Companies */}
      <div className="mt-12 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-900">Companies</h2>
          <Link to="/setup" className="text-sm text-gray-500 hover:text-gray-900">
            Add company
          </Link>
        </div>
        <div className="flex gap-2 flex-wrap">
          {companies.map((company) => (
            <span
              key={company.id}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
            >
              {company.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
