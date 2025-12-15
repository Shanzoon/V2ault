'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseAuthReturn {
  isAdmin: boolean;
  isLoading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setIsAdmin(data.isAdmin);
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsAdmin(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsAdmin(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  // 启动时自动检查认证状态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    isAdmin,
    isLoading,
    login,
    logout,
    checkAuth,
  };
}
