import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearAuth: () => void;
  isValidating: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateStoredKey = async () => {
      const storedKey = apiClient.getApiKey();
      if (storedKey) {
        // Validate the stored key before setting as authenticated
        const isValid = await apiClient.validateApiKey(storedKey);
        if (isValid) {
          setApiKeyState(storedKey);
          setIsAuthenticated(true);
        } else {
          // Key is invalid, clear it
          apiClient.clearApiKey();
        }
      }
      setIsValidating(false);
    };

    validateStoredKey();
  }, []);

  const setApiKey = (key: string) => {
    apiClient.setApiKey(key);
    setApiKeyState(key);
    setIsAuthenticated(true);
  };

  const clearAuth = () => {
    apiClient.clearApiKey();
    setApiKeyState(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, apiKey, setApiKey, clearAuth, isValidating }}>
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

