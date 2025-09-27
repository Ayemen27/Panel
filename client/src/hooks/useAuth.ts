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

// Dummy apiRequest function for demonstration purposes
// In a real application, this would be your actual API fetching logic
async function apiRequest(url: string): Promise<any> {
  // Simulate API call
  if (url === "/api/user") {
    // Simulate an unauthorized response if no token is present (for testing)
    const token = localStorage.getItem("authToken"); // Or wherever you store your token
    if (!token) {
      const error = new Error("401 Unauthorized");
      (error as any).status = 401; // Attach status for the isUnauthorizedError function
      throw error;
    }
    // Simulate a successful response
    return {
      id: "user123",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      profileImageUrl: "http://example.com/profile.jpg"
    };
  }
  return {}; // Default return for other URLs
}


export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/user"],
    queryFn: async (): Promise<User | null> => {
      try {
        // Replacing the original fetch call with a call to a dummy apiRequest
        // In a real scenario, you would replace this with your actual API call or hook
        const data = await apiRequest("/api/user");
        console.log('✅ User authenticated:', data?.firstName); // Changed from username to firstName for consistency
        return data;
      } catch (error) {
        if (isUnauthorizedError(error as Error)) {
          console.log('🚫 User not authenticated - showing auth page');
          // لا تعيد تحميل الصفحة، فقط ارجع null
          return null;
        }
        console.error('❌ Auth error:', error);
        throw error;
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Re-check every 5 minutes
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error as Error)) {
        console.log('Auth failed - unauthorized error, not retrying');
        return false; // Don't retry unauthorized errors
      }
      console.log('Auth retry attempt:', failureCount);
      return failureCount < 2;
    },
  });

  console.log('useAuth - user:', user, 'isLoading:', isLoading, 'error:', error);

  // Handle different authentication states
  const isAuthenticated = user ? true : 
    (error && isUnauthorizedError(error as Error)) ? false : 
    (!isLoading && !user && !error) ? false : undefined;

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();


  // تحديث isLoading
  useEffect(() => {
    // This useEffect is no longer directly tied to isAuthLoading from useQuery
    // The isLoading from useQuery is now directly returned.
    // If there's a need for a separate isLoading state managed by this hook,
    // it would need to be re-introduced with its own useState and setters.
  }, [isLoading]); // Dependency on isLoading from useQuery

  // معالجة إعادة التوجيه بعد المصادقة الناجحة
  useEffect(() => {
    // Ensure we don't navigate if the authentication state is still undefined
    if (isAuthenticated === undefined) {
      return;
    }

    if (isAuthenticated && user) {
      const currentPath = window.location.pathname;
      console.log('Authenticated user detected, current path:', currentPath);

      // إعادة التوجيه للـ dashboard إذا كان المستخدم في صفحة landing أو auth
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/auth') {
        console.log('Redirecting to dashboard...');
        navigate('/dashboard');
      }
    } else if (!isAuthenticated) {
      const currentPath = window.location.pathname;
      // إعادة التوجيه لصفحة تسجيل الدخول إذا كان المستخدم غير مصادق عليه وفي صفحة محمية
      if (currentPath !== '/' && currentPath !== '/login' && currentPath !== '/auth') {
        console.log('Unauthenticated user detected, redirecting to login...');
        navigate('/');
      }
    }
  }, [isAuthenticated, user, navigate]); // Dependencies are isAuthenticated, user, and navigate

  const logout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      queryClient.setQueryData(["/api/user"], null);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      // في حالة الخطأ، نقوم بتنظيف البيانات محلياً والتوجيه للصفحة الرئيسية
      queryClient.setQueryData(["/api/user"], null);
      navigate('/');
    }
  };

  // Role checking helpers
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!user?.role) return false;
    return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
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
}