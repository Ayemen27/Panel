
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
          credentials: "include",
        });

        if (!response.ok) {
          return null;
        }

        const user = await response.json();
        return user;
      } catch (error) {
        console.error('Auth error:', error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isAuthenticated = !!user;

  // تحديث isLoading
  useEffect(() => {
    setIsLoading(isAuthLoading);
  }, [isAuthLoading]);

  // معالجة إعادة التوجيه بعد المصادقة الناجحة
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      const currentPath = window.location.pathname;
      // إعادة التوجيه للـ dashboard إذا كان المستخدم في صفحة landing
      if (currentPath === '/' || currentPath === '/login') {
        navigate('/dashboard');
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
