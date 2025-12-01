import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Sparkles, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [clientName, setClientName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const { setApiKey: setAuthApiKey } = useAuth();
  const navigate = useNavigate();

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsCreating(true);

    try {
      const response = await apiClient.createClient(clientName);
      if (response.success) {
        setAuthApiKey(response.data.api_key);
        navigate('/');
      } else {
        setError('Failed to create client');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create client');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setAuthApiKey(apiKey);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">BrandForge Studio</h1>
          <p className="text-gray-600">AI-Powered Marketing Content Creation</p>
        </div>

        <div className="card">
          <div className="space-y-6">
            {/* Create New Client */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Create New Account
              </h2>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Enter your company name"
                    className="input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </form>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            {/* Login with API Key */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Login with API Key
              </h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="input"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full">
                  Login
                </button>
              </form>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account? Create one above to get started.
        </p>
      </div>
    </div>
  );
}

