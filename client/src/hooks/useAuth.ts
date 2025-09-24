
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  // التحقق من المصادقة المخصصة
  const { data: customUser, isLoading: isCustomLoading } = useQuery({
    queryKey: ["/api/custom-auth/me"],
    queryFn: async () => {
      const token = localStorage.getItem('customAuthToken');
      if (!token) return null;

      const response = await fetch('/api/custom-auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem('customAuthToken');
        localStorage.removeItem('customRefreshToken');
        localStorage.removeItem('currentUser');
        return null;
      }

      const data = await response.json();
      return data.success ? data.user : null;
    },
    enabled: !!localStorage.getItem('customAuthToken'),
    retry: false,
  });

  // التحقق من مصادقة Replit
  const { data: replitUser, isLoading: isReplitLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });

      if (!response.ok) {
        return null;
      }

      return response.json();
    },
    enabled: !localStorage.getItem('customAuthToken'),
    retry: false,
  });

  useEffect(() => {
    setIsLoading(isCustomLoading || isReplitLoading);
  }, [isCustomLoading, isReplitLoading]);

  const user = customUser || replitUser;
  const isAuthenticated = !!user;

  const logout = async () => {
    const customToken = localStorage.getItem('customAuthToken');
    
    if (customToken) {
      // تسجيل خروج النظام المخصص
      try {
        await fetch('/api/custom-auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${customToken}`,
          },
        });
      } catch (error) {
        console.error('Custom logout error:', error);
      }
      
      localStorage.removeItem('customAuthToken');
      localStorage.removeItem('customRefreshToken');
      localStorage.removeItem('currentUser');
    } else {
      // تسجيل خروج Replit
      window.location.href = "/api/logout";
      return;
    }

    queryClient.clear();
    window.location.href = "/";
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
  };
}
