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
  token?: string; // Session ID used as token for WebSocket authentication
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

  // State for managing loading, user data, and errors
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // تحسين تحميل بيانات المستخدم مع دعم متعدد المصادر - مبسط
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // محاولة تحميل بيانات المستخدم من الكوكيز أولاً
        const userData = await fetchUserData();
        if (userData) {
          setUser(userData);
          authLog('User Loaded Successfully', {
            userId: userData.id,
            username: userData.username,
            role: userData.role
          });
        } else {
          authLog('No User Found');
        }
      } catch (err: any) {
        console.error('Failed to load user:', err);
        setError(err.message || 'Failed to load user data.');
        authLog('Error Loading User', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Minimal query setup for refetching when needed
  const { refetch } = useQuery({
    queryKey: ["/api/user"],
    queryFn: fetchUserData,
    enabled: false, // Disable automatic fetching
    retry: false,
  });

  // Determine authentication status
  const isAuthenticated = !!user;

  // Simple debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('useAuth - user:', user, 'isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
  }

  // Login mutation
  // Assuming apiRequest is a globally available or imported function for making API calls
  // If not, you'll need to define or import it. For this example, let's mock it.
  const apiRequest = async (method: string, url: string, body?: any): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Security: Only use httpOnly cookies - no localStorage token for security

    // If making a request that relies on cookies, ensure 'credentials' is set appropriately
    // For login, we might send credentials and expect a cookie OR a token back.
    // Let's assume the backend handles returning a token in the response body for this scenario.
    const fetchOptions: RequestInit = {
      method,
      headers,
      credentials: 'include', // Include cookies for authentication
    };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    return fetch(url, fetchOptions);
  };


  const login = async (username: string, password: string): Promise<{ success: boolean, error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest('POST', '/api/login', {
        username,
        password
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Security: Only use httpOnly cookies - no localStorage token storage

          // Update local user state
          setUser(data.user || data); // Set user data from response
          authLog('Login Success', { userId: data.user?.id || data.id });

          setTimeout(() => {
            navigate('/dashboard');
          }, 100);
          return { success: true };
        } else {
          const errorMsg = data.message || 'Login failed';
          setError(errorMsg);
          authLog('Login Failed', { message: errorMsg });
          return { success: false, error: errorMsg };
        }
      } else {
        const errorText = await response.text();
        let errorMsg = 'Login failed';

        try {
          const errorData = JSON.parse(errorText);
          errorMsg = errorData.message || errorMsg;
        } catch {
          if (response.status === 401) {
            errorMsg = 'Invalid username or password';
          } else if (response.status >= 500) {
            errorMsg = 'Server error, please try again';
          } else {
            errorMsg = errorText || 'An unknown error occurred';
          }
        }

        setError(errorMsg);
        authLog('Login Error Response', { status: response.status, message: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error: any) {
      console.error('Login API error:', error);
      const errorMsg = 'Failed to connect to the server';
      setError(errorMsg);
      authLog('Login Exception', { error: error.message });
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout mutation
  const logout = async (): Promise<void> => {
    try {
      // Attempt to logout via API (this might clear server-side sessions/tokens)
      await apiRequest('POST', '/api/logout');
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local cleanup even if API logout fails
    } finally {
      // Security: Only httpOnly cookies used - no localStorage cleanup needed

      // Clear local user state and React Query cache
      setUser(null);
      setError(null);
      queryClient.clear(); // Clears all query cache entries
      authLog('Logout Success', { userId: user?.id, username: user?.username });

      // Navigate to home page
      navigate('/');
    }
  };

  // Handle authentication state changes and navigation - simplified
  useEffect(() => {
    if (isLoading) return; // Still loading initial state

    const currentPath = window.location.pathname;

    if (isAuthenticated && user) {
      // Redirect authenticated users away from auth pages
      if (currentPath === '/' || currentPath === '/auth' || currentPath === '/login') {
        setTimeout(() => navigate('/dashboard'), 100);
      }
    } else if (!isAuthenticated) {
      // Redirect unauthenticated users to auth page
      const isProtectedRoute = !['/auth', '/login', '/'].includes(currentPath);
      if (isProtectedRoute) {
        setTimeout(() => navigate('/auth'), 100);
      }
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Role checking helpers
  const hasRole = (requiredRole: UserRole): boolean => {
    const userRole = user?.role;
    if (!userRole) return false;
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
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
    error: error, // Return the error message string or null
    refetch, // Expose refetch if needed for manual refresh
    // Role helpers
    hasRole,
    hasAnyRole,
    isAdmin,
    isModerator,
    isUser,
    isViewer,
  };
};