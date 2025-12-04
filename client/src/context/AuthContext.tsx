import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  apiKey: string | null;
  clientName: string | null;
  setApiKey: (key: string, clientName?: string) => void;
  clearAuth: () => void;
  isValidating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [clientName, setClientNameState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateStoredKey = async () => {
      const storedKey = apiClient.getApiKey();
      const storedName = localStorage.getItem('brandforge_client_name');
      if (storedKey) {
        // Validate the stored key before setting as authenticated
        const isValid = await apiClient.validateApiKey(storedKey);
        if (isValid) {
          setApiKeyState(storedKey);
          if (storedName) {
            setClientNameState(storedName);
          }
          setIsAuthenticated(true);
        } else {
          // Key is invalid, clear it
          apiClient.clearApiKey();
          localStorage.removeItem('brandforge_client_name');
        }
      }
      setIsValidating(false);
    };

    validateStoredKey();
  }, []);

  const setApiKey = (key: string, name?: string) => {
    apiClient.setApiKey(key);
    setApiKeyState(key);
    if (name) {
      setClientNameState(name);
      localStorage.setItem('brandforge_client_name', name);
    }
    setIsAuthenticated(true);
  };

  const clearAuth = () => {
    apiClient.clearApiKey();
    localStorage.removeItem('brandforge_client_name');
    setApiKeyState(null);
    setClientNameState(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, apiKey, clientName, setApiKey, clearAuth, isValidating }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

