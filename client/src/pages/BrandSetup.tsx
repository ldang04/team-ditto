import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Loader2, ArrowRight, Check } from 'lucide-react';

type Step = 'company' | 'campaign' | 'complete';

export default function BrandSetup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('company');
  const [createdThemeId, setCreatedThemeId] = useState<string>('');

  // Company form state
  const [companyName, setCompanyName] = useState('');
  const [companyStyle, setCompanyStyle] = useState('');
  const [companyInspirations, setCompanyInspirations] = useState('');

  // Campaign form state
  const [campaignName, setCampaignName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Create theme mutation
  const createThemeMutation = useMutation({
    mutationFn: () => apiClient.createTheme({
      name: companyName,
      tags: companyStyle.split(',').map(t => t.trim()).filter(Boolean),
      inspirations: companyInspirations.split(',').map(i => i.trim()).filter(Boolean),
    }),
    onSuccess: (response) => {
      if (response.success && response.data.id) {
        setCreatedThemeId(response.data.id);
        queryClient.invalidateQueries({ queryKey: ['themes'] });
        setStep('campaign');
      }
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: () => apiClient.createProject({
      name: campaignName,
      customer_type: targetAudience,
      theme_id: createdThemeId,
    }),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        setStep('complete');
        setTimeout(() => navigate('/'), 1500);
      }
    },
  });

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10 text-sm text-gray-400">
          <span className={step === 'company' ? 'text-gray-900 font-medium' : ''}>Company</span>
          <span>→</span>
          <span className={step === 'campaign' ? 'text-gray-900 font-medium' : ''}>Campaign</span>
          <span>→</span>
          <span className={step === 'complete' ? 'text-gray-900 font-medium' : ''}>Done</span>
        </div>

        {/* Step 1: Company */}
        {step === 'company' && (
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Tell us about your company</h1>
            <p className="text-gray-500 mb-8">
              We'll use this to keep your content on-brand.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); createThemeMutation.mutate(); }} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Company name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">How would you describe your style?</label>
                <input
                  type="text"
                  value={companyStyle}
                  onChange={(e) => setCompanyStyle(e.target.value)}
                  placeholder="modern, friendly, professional"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Separate with commas</p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Companies you admire (optional)</label>
                <input
                  type="text"
                  value={companyInspirations}
                  onChange={(e) => setCompanyInspirations(e.target.value)}
                  placeholder="Apple, Stripe, Notion"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={!companyName || createThemeMutation.isPending}
                className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {createThemeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Campaign */}
        {step === 'campaign' && (
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Create your first campaign</h1>
            <p className="text-gray-500 mb-8">
              Campaigns help organize your marketing content.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); createProjectMutation.mutate(); }} className="space-y-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Campaign name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Summer Sale, Product Launch..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Who's your audience?</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Small business owners, young professionals..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!campaignName || !targetAudience || createProjectMutation.isPending}
                className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {createProjectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Create Campaign
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 'complete' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">You're all set!</h1>
            <p className="text-gray-500">Taking you to your dashboard...</p>
          </div>
        )}
      </div>
    </div>
  );
}
