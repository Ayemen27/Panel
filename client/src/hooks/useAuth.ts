import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface User {
  id: string;
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user' | 'moderator' | 'viewer';
  profileImageUrl?: string;
}

export type UserRole = 'admin' | 'user' | 'moderator' | 'viewer';

// Role hierarchy - higher roles include permissions of lower roles
export const ROLE_HIERARCHY = {
  admin: 4,
  moderator: 3,
  user: 2,
  viewer: 1,
} as const;

// Helper function to check for unauthorized errors
function isUnauthorizedError(error: any): boolean {
  if (!error) return false;
  const message = error.message || error.toString();
  return message.includes('401') || 
         message.includes('Unauthorized') ||
         message.toLowerCase().includes('unauthorized');
}

// Real API request function for user data
async function fetchUserData(): Promise<User | null> {
  try {
    const response = await fetch("/api/user", {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // User not authenticated
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    if (isUnauthorizedError(error)) {
      return null; // User not authenticated
    }
    throw error; // Re-throw other errors
  }
}

const authLog = (action: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`🔐 [Auth ${timestamp}] ${action}:`, data || '');
};

export const useAuth = () => {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Use React Query to manage user authentication state
  const {
    data: user,
    isLoading,
    error,
    isError,
    refetch
  } = useQuery({
    queryKey: ["/api/user"],
    queryFn: fetchUserData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized) errors
      if (isUnauthorizedError(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Determine authentication status
  const isAuthenticated = user ? true : (isError && isUnauthorizedError(error)) ? false : undefined;

  // Console logging for debugging
  console.log('useAuth - user:', user, 'isLoading:', isLoading, 'error:', error, 'isAuthenticated:', isAuthenticated);

  // Detailed auth logging
  authLog('Auth State', {
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    role: user?.role,
    isLoading,
    isAuthenticated,
    error: error?.message
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'فشل تسجيل الدخول');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      authLog('Login Success', {
        userId: data.id,
        username: data.username,
        role: data.role
      });

      // Update query cache immediately
      queryClient.setQueryData(["/api/user"], data);

      // Navigate to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    },
    onError: (error: Error) => {
      authLog('Login Error', {
        error: error.message
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('فشل تسجيل الخروج');
      }

      return response.json();
    },
    onSuccess: () => {
      authLog('Logout Success', {
        userId: user?.id,
        username: user?.username
      });

      // Clear user data from cache
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      // Navigate to home
      navigate('/');
    },
    onError: (error: Error) => {
      authLog('Logout Error', {
        error: error.message
      });

      // Even if logout fails on server, clear local state
      queryClient.setQueryData(["/api/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      navigate('/');
    },
  });

  // Handle authentication state changes and navigation
  useEffect(() => {
    if (isAuthenticated === undefined) return; // Still loading

    const currentPath = window.location.pathname;

    if (isAuthenticated && user) {
      authLog('User authenticated - checking for navigation', {
        userId: user.id,
        username: user.username,
        role: user.role,
        currentPath
      });

      // Only redirect if we're on auth-related pages
      if (currentPath === '/' || currentPath === '/auth' || currentPath === '/login') {
        authLog('Redirecting authenticated user to dashboard', { from: currentPath });
        setTimeout(() => {
          navigate('/dashboard');
          console.log('✅ Navigation executed to dashboard from:', currentPath);
        }, 100);
      }
    } else if (isAuthenticated === false) {
      authLog('User not authenticated - checking for navigation', {
        error: error?.message,
        currentPath
      });

      // Only redirect if we're on protected routes
      const isProtectedRoute = !['/auth', '/login', '/'].includes(currentPath);
      if (isProtectedRoute) {
        authLog('Redirecting unauthenticated user to auth page', { from: currentPath });
        setTimeout(() => {
          navigate('/auth');
          console.log('✅ Navigation executed to auth from:', currentPath);
        }, 100);
      }
    }
  }, [isAuthenticated, user, error, navigate]);

  // Wrapper functions for backward compatibility
  const login = async (username: string, password: string): Promise<void> => {
    return loginMutation.mutateAsync({ username, password });
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  // Role checking helpers
  const hasRole = (requiredRole: UserRole): boolean => {
    const userRole = user?.role;
    if (!userRole) return false;
    const roleHierarchy = {
      admin: 4,
      moderator: 3,
      user: 2,
      viewer: 1,
    };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  };

  const hasAnyRole = (requiredRoles: UserRole[]): boolean => {
    return requiredRoles.some(role => hasRole(role));
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  const isModerator = (): boolean => {
    return hasRole('moderator');
  };

  const isUser = (): boolean => {
    return hasRole('user');
  };

  const isViewer = (): boolean => {
    return hasRole('viewer');
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    error: error?.message || null,
    refetch,
    // Role helpers
    hasRole,
    hasAnyRole,
    isAdmin,
    isModerator,
    isUser,
    isViewer,
  };
};