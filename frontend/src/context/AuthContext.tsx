// Authentication Context for Telkom Contract Extractor
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from '../services/api';
import type { LoginRequest, UserRole } from '../types/api';

interface AuthUser {
  username: string;
  token: string;
  role: UserRole;
  userId: number;
  email?: string;
  fullName?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isManager: boolean;
  isStaff: boolean;
  userRole: UserRole | null;
  refreshUserInfo: () => Promise<void>;
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
      const role = localStorage.getItem('authRole') as UserRole | null;
      const userId = localStorage.getItem('authUserId');

      if (token && username && role && userId) {
        try {
          // Fetch full user info to verify token and get latest data
          const userInfo = await apiClient.getCurrentUser();
          setUser({
            username: userInfo.username,
            token,
            role: userInfo.role as UserRole,
            userId: userInfo.user_id,
            email: userInfo.email,
            fullName: userInfo.full_name || undefined,
          });
        } catch (error) {
          // Token is invalid, clear all stored data
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUsername');
          localStorage.removeItem('authRole');
          localStorage.removeItem('authUserId');
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
        role: response.role as UserRole,
        userId: response.user_id,
      };

      // Store username, role, and userId in localStorage for persistence
      localStorage.setItem('authUsername', response.username);
      localStorage.setItem('authRole', response.role);
      localStorage.setItem('authUserId', response.user_id.toString());

      // Fetch full user info for email/full_name
      try {
        const userInfo = await apiClient.getCurrentUser();
        userData.email = userInfo.email;
        userData.fullName = userInfo.full_name || undefined;
      } catch (err) {
        console.warn('Could not fetch full user info:', err);
      }

      setUser(userData);
    } catch (error) {
      // Clear any existing auth data on login failure
      apiClient.clearToken();
      localStorage.removeItem('authUsername');
      localStorage.removeItem('authRole');
      localStorage.removeItem('authUserId');
      throw error;
    }
  };

  const logout = () => {
    apiClient.logout();
    localStorage.removeItem('authUsername');
    localStorage.removeItem('authRole');
    localStorage.removeItem('authUserId');
    setUser(null);
  };

  const refreshUserInfo = async () => {
    try {
      const userInfo = await apiClient.getCurrentUser();
      setUser(prev => prev ? {
        ...prev,
        email: userInfo.email,
        fullName: userInfo.full_name || undefined,
        role: userInfo.role as UserRole,
      } : null);
    } catch (error) {
      console.error('Failed to refresh user info:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
    isManager: user?.role === 'MANAGER',
    isStaff: user?.role === 'STAFF' || user?.role === 'MANAGER',
    userRole: user?.role || null,
    refreshUserInfo,
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