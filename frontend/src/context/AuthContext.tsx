// Authentication Context for Telkom Contract Extractor
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/api';
import type { LoginRequest } from '../types/api';

interface AuthUser {
  username: string;
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated on app startup
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      const username = localStorage.getItem('authUsername');
      
      if (token && username) {
        try {
          // Verify token is still valid by making a test request
          await apiClient.getHealth();
          setUser({ username, token });
        } catch (error) {
          // Token is invalid, clear stored data
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUsername');
          apiClient.clearToken();
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const response = await apiClient.login(credentials);
      
      const userData: AuthUser = {
        username: response.username,
        token: response.access_token,
      };
      
      // Store username in localStorage for persistence
      localStorage.setItem('authUsername', response.username);
      
      setUser(userData);
    } catch (error) {
      // Clear any existing auth data on login failure
      apiClient.clearToken();
      localStorage.removeItem('authUsername');
      throw error;
    }
  };

  const logout = () => {
    apiClient.logout();
    localStorage.removeItem('authUsername');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
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