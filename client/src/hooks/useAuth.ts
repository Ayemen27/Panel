import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
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
function isUnauthorizedError(error: Error): boolean {
  return error.message.includes('401') || 
         error.message.includes('Unauthorized') ||
         error.message.toLowerCase().includes('unauthorized');
}

// Real API request function
async function apiRequest(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        const error = new Error("401 Unauthorized");
        (error as any).status = 401;
        throw error;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

// Dummy functions for token management (replace with actual implementation)
const getToken = () => localStorage.getItem('authToken');
const setToken = (token: string) => localStorage.setItem('authToken', token);
const removeToken = () => localStorage.removeItem('authToken');

const authLog = (action: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`🔐 [Auth ${timestamp}] ${action}:`, data || '');
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Console logging for debugging
  console.log('useAuth - user:', user, 'isLoading:', isLoading, 'error:', error);

  // Detailed auth logging
  authLog('Auth State', {
    hasUser: !!user,
    userId: user?.id,
    username: user?.username,
    role: user?.role,
    isLoading,
    error,
    token: !!getToken()
  });

  const queryClient = useQueryClient();

  const login = async (username: string, password: string): Promise<void> => {
    authLog('Login Started', {
      username,
      timestamp: new Date().toISOString()
    });

    setIsLoading(true);
    setError(null);

    try {
      // Assuming apiRequest can handle POST requests with body
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: 'Unknown error' };
        }
        authLog('Login Failed', {
          username,
          status: response.status,
          error: errorData.message,
          response: errorData
        });
        throw new Error(errorData.message || 'فشل تسجيل الدخول');
      }

      const data = await response.json();
      authLog('Login Success', {
        username,
        userId: data.user?.id,
        role: data.user?.role,
        hasToken: !!data.token
      });

      setToken(data.token);
      setUser(data.user);
      // Invalidate and refetch user query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    } catch (err: any) {
      authLog('Login Error', {
        username,
        error: err.message,
        stack: err.stack
      });
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authLog('Logout', {
      userId: user?.id,
      username: user?.username,
      reason: 'user_initiated'
    });

    removeToken();
    setUser(null);
    setError(null);
    queryClient.invalidateQueries({ queryKey: ["/api/user"] }); // Clear user data from cache
  };

  const validateToken = async () => {
    const token = getToken();

    authLog('Token Validation Started', {
      hasToken: !!token,
      tokenLength: token?.length
    });

    if (!token) {
      authLog('Token Validation: No Token', {
        action: 'skip_validation'
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/validate', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        authLog('Token Validation Failed', {
          status: response.status,
          statusText: response.statusText,
          action: 'remove_token'
        });
        removeToken();
        setUser(null);
        setError('انتهت صلاحية الجلسة');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      authLog('Token Validation Success', {
        userId: data.user?.id,
        username: data.user?.username,
        role: data.user?.role
      });
      setUser(data.user);
    } catch (err: any) {
      authLog('Token Validation Error', {
        error: err.message,
        stack: err.stack,
        action: 'remove_token'
      });
      removeToken();
      setUser(null);
      setError('خطأ في التحقق من الجلسة');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    validateToken();
  }, []); // Run validation on mount

  // Handle authentication state changes and navigation
  const isAuthenticated = user ? true : (error && isUnauthorizedError(error as Error)) ? false : (!isLoading && !user && !error) ? false : undefined;

  const [, navigate] = useLocation();

  // Update isLoading based on queryClient state for auth query
  // This is a bit of a workaround as useAuth hook doesn't directly expose useQuery's isLoading state
  useEffect(() => {
    const authQueryState = queryClient.getQueryState(["/api/user"]);
    if (authQueryState && authQueryState.status === 'pending') {
      setIsLoading(true);
    } else if (authQueryState && authQueryState.status === 'error') {
      // If there's an error and it's an unauthorized error, set isAuthenticated to false
      if (isUnauthorizedError(authQueryState.error as Error)) {
        setError(authQueryState.error as any);
        setIsLoading(false);
      } else {
        // Handle other types of errors
        setError(authQueryState.error as any);
        setIsLoading(false);
      }
    } else if (authQueryState && authQueryState.status === 'success') {
      setUser(authQueryState.data as User);
      setIsLoading(false);
    }
  }, [queryClient]);

  // Effect for handling redirection based on authentication status
  useEffect(() => {
    if (isAuthenticated === undefined) return;

    const currentPath = window.location.pathname;

    if (isAuthenticated && user) {
      authLog('Authentication Success', {
        userId: user.id,
        username: user.username,
        role: user.role,
        currentPath
      });
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/auth') {
        authLog('Redirecting to dashboard', { from: currentPath });
        navigate('/dashboard');
      }
    } else if (isAuthenticated === false) {
      authLog('Authentication Failed', {
        error,
        currentPath
      });
      if (currentPath !== '/' && currentPath !== '/login' && currentPath !== '/auth') {
        authLog('Redirecting to home/login', { from: currentPath });
        navigate('/');
      }
    }
  }, [isAuthenticated, user, error, navigate]);

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
    error,
    // Role helpers
    hasRole,
    hasAnyRole,
    isAdmin,
    isModerator,
    isUser,
    isViewer,
  };
};