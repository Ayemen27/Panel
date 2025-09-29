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

  // تحسين تحميل بيانات المستخدم مع دعم متعدد المصادر
  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 🔧 KIWI COMPATIBILITY: تجربة مصادر متعددة للمصادقة
        let userData = null;

        // الطريقة الأولى: الكوكيز العادية
        try {
          userData = await fetchUserData();
          if (userData) {
            console.log('✅ Authenticated via standard cookies');
          }
        } catch (err) {
          console.log('⚠️ Standard cookie auth failed, trying alternatives...');
        }

        // الطريقة الثانية: التوكن من localStorage
        if (!userData) {
          const token = localStorage.getItem('authToken');
          if (token) {
            console.log('🔐 Attempting authentication with stored token...');
            try {
              const response = await fetch('/api/user', {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              });

              if (response.ok) {
                userData = await response.json();
                userData.token = token;
                console.log('✅ Authenticated with localStorage token');
              } else if (response.status === 401) {
                console.log('❌ Stored token is invalid, removing...');
                localStorage.removeItem('authToken');
              }
            } catch (tokenErr) {
              console.log('Token auth failed:', tokenErr);
              localStorage.removeItem('authToken');
            }
          }
        }

        // 🔧 KIWI FALLBACK: الطريقة الثالثة - كوكيز التوكن الاحتياطية
        if (!userData) {
          // تحقق من وجود كوكيز احتياطية في المتصفح
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('authToken='))
            ?.split('=')[1];

          const cookieUserId = document.cookie
            .split('; ')
            .find(row => row.startsWith('userId='))
            ?.split('=')[1];

          if (cookieToken) {
            console.log('🔐 Attempting authentication with cookie token...');
            try {
              const response = await fetch('/api/user', {
                headers: {
                  'Authorization': `Bearer ${cookieToken}`,
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              });

              if (response.ok) {
                userData = await response.json();
                userData.token = cookieToken;
                // حفظ التوكن في localStorage أيضاً
                localStorage.setItem('authToken', cookieToken);
                console.log('✅ Authenticated with cookie token');
              }
            } catch (cookieErr) {
              console.log('Cookie token auth failed:', cookieErr);
            }
          }

          // إذا كان لدينا معرف مستخدم على الأقل
          if (!userData && cookieUserId) {
            console.log('🔐 Found userId in cookies, creating minimal user object');
            userData = {
              id: cookieUserId,
              username: 'unknown',
              role: 'user'
            };
          }
        }

        if (userData) {
          setUser(userData);
          authLog('User Loaded Successfully', {
            userId: userData.id,
            username: userData.username,
            role: userData.role,
            authMethod: userData.token ? 'token' : 'session'
          });
        } else {
          authLog('No User Found - All auth methods failed');
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

  // Use React Query for managing API calls and caching, but manage auth state manually
  const { refetch } = useQuery({
    queryKey: ["/api/user"],
    queryFn: fetchUserData, // This will still be used for cookie-based auth
    enabled: false, // Disable automatic fetching, we handle it manually
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Determine authentication status
  const isAuthenticated = !!user;

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
    error: error
  });

  // Login mutation
  // Assuming apiRequest is a globally available or imported function for making API calls
  // If not, you'll need to define or import it. For this example, let's mock it.
  const apiRequest = async (method: string, url: string, body?: any): Promise<Response> => {
    const token = localStorage.getItem('authToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // If making a request that relies on cookies, ensure 'credentials' is set appropriately
    // For login, we might send credentials and expect a cookie OR a token back.
    // Let's assume the backend handles returning a token in the response body for this scenario.
    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    // For login, we might rely on cookies if the backend sets them, or expect a token.
    // If the backend *only* sets cookies, `credentials: 'include'` is needed.
    // If it returns a token in the body, we don't strictly need `credentials: 'include'` here.
    // Let's assume it returns a token in the body. If it relies on cookies, `credentials: 'include'` should be added.
    // fetchOptions.credentials = 'include'; // Uncomment if backend relies on cookies for login response

    return fetch(url, fetchOptions);
  };


  const login = async (username: string, password: string): Promise<{ success: boolean, error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiRequest('POST', '/api/auth/login', {
        username,
        password
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Save token to localStorage for browsers that don't support cookies well
          if (data.token) {
            localStorage.setItem('authToken', data.token);
            console.log('🔐 Token saved for fallback authentication');
          }

          // Update local user state and potentially refetch with cookies if the server also sets them
          setUser(data); // Assuming login response includes user data
          authLog('Login Success', {
            userId: data.id,
            username: data.username,
            role: data.role
          });

          // Try to refetch using cookies as well, in case the server set them
          try {
            const cookieUserData = await fetchUserData();
            if (cookieUserData) {
              setUser(cookieUserData); // Prefer cookie data if available
              authLog('User data updated via cookies after login');
            }
          } catch (refetchError) {
            console.warn('Could not refetch user data via cookies after login:', refetchError);
          }

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
      await apiRequest('POST', '/api/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local cleanup even if API logout fails
    } finally {
      // Clear token from localStorage
      localStorage.removeItem('authToken');
      console.log('🔐 Token removed on logout');

      // Clear local user state and React Query cache
      setUser(null);
      setError(null);
      queryClient.clear(); // Clears all query cache entries
      authLog('Logout Success', { userId: user?.id, username: user?.username });

      // Navigate to home page
      navigate('/');
    }
  };

  // Handle authentication state changes and navigation
  useEffect(() => {
    if (isLoading) return; // Still loading initial state

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
    } else if (!isAuthenticated && !isLoading) { // Explicitly check !isLoading to ensure we've finished loading
      authLog('User not authenticated - checking for navigation', {
        error: error,
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
  }, [isAuthenticated, isLoading, user, error, navigate]);

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