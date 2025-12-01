import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const storedKey = apiClient.getApiKey();
    if (storedKey) {
      setApiKeyState(storedKey);
      setIsAuthenticated(true);
    }
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
    <AuthContext.Provider value={{ isAuthenticated, apiKey, setApiKey, clearAuth }}>
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

