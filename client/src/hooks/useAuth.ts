
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profileImageUrl?: string;
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // التحقق من مصادقة Replit فقط
  const { data: user, isLoading: isAuthLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async (): Promise<User | null> => {
      try {
        const response = await fetch("/api/auth/user", {
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
    // تسجيل خروج Replit
    window.location.href = "/api/logout";
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    error,
  };
}
