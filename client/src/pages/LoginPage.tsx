import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Sparkles, Loader2, Copy, CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [clientName, setClientName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const { setApiKey: setAuthApiKey } = useAuth();
  const navigate = useNavigate();

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsCreating(true);
    setCreatedApiKey(null);

    try {
      const response = await apiClient.createClient(clientName);
      if (response.success) {
        // Show the API key so user can save it
        setCreatedApiKey(response.data.api_key);
        // Still log them in automatically
        setAuthApiKey(response.data.api_key, clientName);
      } else {
        setError('Failed to create client');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create client');
    } finally {
      setIsCreating(false);
    }
  };

  const copyApiKey = () => {
    if (createdApiKey) {
      navigator.clipboard.writeText(createdApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContinueAfterCreation = () => {
    setCreatedApiKey(null);
    navigate('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsValidating(true);

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      setIsValidating(false);
      return;
    }

    try {
      // Validate the API key before allowing login
      const isValid = await apiClient.validateApiKey(apiKey.trim());
      
      if (isValid) {
        // Key is valid, set it and navigate
        setAuthApiKey(apiKey.trim());
        navigate('/');
      } else {
        // Key is invalid
        setError('Invalid API key. Please check your key and try again.');
      }
    } catch (err: any) {
      // Handle network errors or other issues
      setError(err.response?.data?.message || 'Failed to validate API key. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">LinkLaunch</h1>
          <p className="text-gray-600">LinkedIn Marketing Campaign Builder</p>
          <p className="text-xs text-gray-400 mt-1">Powered by Ditto Content API</p>
        </div>

        <div className="card">
          <div className="space-y-6">
            {/* Show API Key After Creation */}
            {createdApiKey ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <h2 className="text-lg font-semibold text-green-900">
                      Account Created Successfully!
                    </h2>
                  </div>
                  <p className="text-sm text-green-800 mb-4">
                    <strong>Important:</strong> Save your API key now. You'll need it to log back in later.
                    This is the only time you'll see it.
                  </p>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Your API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={createdApiKey}
                          readOnly
                          className="input font-mono text-sm pr-20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={copyApiKey}
                        className="btn btn-secondary flex items-center gap-2 px-4"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleContinueAfterCreation}
                  className="btn btn-primary w-full"
                >
                  Continue to Dashboard
                </button>
              </div>
            ) : (
              <>
                {/* Create New Client */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Create New Account
                  </h2>
                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Organization Name
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Enter your organization name"
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
                      <p className="text-xs text-gray-500 mt-1">
                        Use the API key you received when creating your account
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={isValidating}
                      className="btn btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        'Login'
                      )}
                    </button>
                  </form>
                </div>
              </>
            )}

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

