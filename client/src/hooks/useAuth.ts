
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

interface AuthResponse {
  isAuthenticated: boolean;
  user: User | null;
  error?: string;
}

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  // إدارة state للـ tokens للتحكم في enabled condition
  const [hasCustomToken, setHasCustomToken] = useState(() => {
    return !!localStorage.getItem('customAuthToken');
  });

  const [hasCheckedTokens, setHasCheckedTokens] = useState(false);

  // التحقق من التحديث في localStorage
  useEffect(() => {
    const checkTokens = () => {
      const customToken = localStorage.getItem('customAuthToken');
      setHasCustomToken(!!customToken);
      setHasCheckedTokens(true);
    };

    checkTokens();
    
    // إضافة listener للتحديثات في localStorage
    window.addEventListener('storage', checkTokens);
    return () => window.removeEventListener('storage', checkTokens);
  }, []);

  // التحقق من المصادقة المخصصة
  const { data: customAuthResult, isLoading: isCustomLoading, error: customError } = useQuery({
    queryKey: ["/api/custom-auth/me"],
    queryFn: async (): Promise<AuthResponse> => {
      try {
        const token = localStorage.getItem('customAuthToken');
        if (!token) {
          return { isAuthenticated: false, user: null };
        }

        const response = await fetch('/api/custom-auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // تنظيف tokens غير الصالحة
          localStorage.removeItem('customAuthToken');
          localStorage.removeItem('customRefreshToken');
          localStorage.removeItem('currentUser');
          setHasCustomToken(false);
          
          if (response.status === 401) {
            return { isAuthenticated: false, user: null, error: 'Token expired' };
          }
          
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success && data.user) {
          return { isAuthenticated: true, user: data.user };
        }
        
        return { isAuthenticated: false, user: null, error: 'Invalid response format' };
      } catch (error) {
        console.error('Custom auth error:', error);
        return { 
          isAuthenticated: false, 
          user: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    },
    enabled: hasCustomToken && hasCheckedTokens,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // التحقق من مصادقة Replit
  const { data: replitAuthResult, isLoading: isReplitLoading, error: replitError } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async (): Promise<AuthResponse> => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 401) {
            return { isAuthenticated: false, user: null };
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const user = await response.json();
        return { isAuthenticated: true, user };
      } catch (error) {
        console.error('Replit auth error:', error);
        return { 
          isAuthenticated: false, 
          user: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    },
    enabled: !hasCustomToken && hasCheckedTokens,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // حساب النتائج النهائية
  const authResult = customAuthResult || replitAuthResult;
  const user = authResult?.user || null;
  const isAuthenticated = authResult?.isAuthenticated || false;
  const authError = customError || replitError || authResult?.error;

  // تحديث isLoading
  useEffect(() => {
    if (!hasCheckedTokens) {
      setIsLoading(true);
    } else {
      setIsLoading(isCustomLoading || isReplitLoading);
    }
  }, [hasCheckedTokens, isCustomLoading, isReplitLoading]);

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
      setHasCustomToken(false);
    } else {
      // تسجيل خروج Replit
      window.location.href = "/api/logout";
      return;
    }

    queryClient.clear();
    navigate('/');
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    error: authError,
  };
}
