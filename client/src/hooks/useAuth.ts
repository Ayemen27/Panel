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

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // التحقق من المصادقة الجديدة
  const { data: user, isLoading: isAuthLoading, error } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async (): Promise<User | null> => {
      try {
        const response = await fetch("/api/user", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.status === 401) {
          // غير مصادق عليه
          return null;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        console.log('Auth check result:', userData);
        return userData;
      } catch (error) {
        console.error('Auth error:', error);
        return null;
      }
    },
    retry: (failureCount, error) => {
      // عدم إعادة المحاولة في حالة 401 (غير مصادق عليه)
      if (error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 2 * 60 * 1000, // دقيقتان
    refetchOnWindowFocus: false,
  });

  const isAuthenticated = !!user;

  // تحديث isLoading
  useEffect(() => {
    setIsLoading(isAuthLoading);
  }, [isAuthLoading]);

  // معالجة إعادة التوجيه بعد المصادقة الناجحة
  useEffect(() => {
    if (!isLoading && user && isAuthenticated) {
      const currentPath = window.location.pathname;
      console.log('Authenticated user detected, current path:', currentPath);

      // إعادة التوجيه للـ dashboard إذا كان المستخدم في صفحة landing أو auth
      if (currentPath === '/' || currentPath === '/login' || currentPath === '/auth') {
        console.log('Redirecting to dashboard...');
        navigate('/dashboard');
      }
    } else if (!isLoading && !user && !isAuthenticated) {
      const currentPath = window.location.pathname;
      // إعادة التوجيه لصفحة تسجيل الدخول إذا كان المستخدم غير مصادق عليه وفي صفحة محمية
      if (currentPath !== '/' && currentPath !== '/login' && currentPath !== '/auth') {
        console.log('Unauthenticated user detected, redirecting to login...');
        navigate('/');
      }
    }
  }, [isAuthenticated, user, isLoading, navigate]);

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