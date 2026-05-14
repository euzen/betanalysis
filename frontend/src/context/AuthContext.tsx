import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, api } from '../services/api';

interface AuthUser {
  id: number;
  username: string;
  email: string;
  is_admin?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser, refreshToken?: string) => void;
  logout: () => void;
  isLoading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, login: () => {}, logout: () => {}, isLoading: true, isAdmin: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = user?.is_admin === true;

  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    if (stored && storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setToken(stored);
        setUser(u);
        setAuthToken(stored);
        // Refresh user data including is_admin
        api.get<{ is_admin: boolean; is_public: boolean }>('/auth/me').then(r => {
          const fresh = { ...u, is_admin: r.data.is_admin, is_public: r.data.is_public };
          setUser(fresh);
          localStorage.setItem('auth_user', JSON.stringify(fresh));
        }).catch(() => {});
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((t: string, u: AuthUser, refreshToken?: string) => {
    setToken(t);
    setUser(u);
    localStorage.setItem('auth_token', t);
    localStorage.setItem('auth_user', JSON.stringify(u));
    setAuthToken(t);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('refresh_token');
    setAuthToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
