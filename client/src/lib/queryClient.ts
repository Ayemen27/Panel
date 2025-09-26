import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { getApiBaseUrl } from "../../../shared/environment";

// Use relative URLs to avoid SSL issues with IP addresses
const API_BASE = `${getApiBaseUrl()}/api`;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  endpoint: string,
  data?: any
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(endpoint, options);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      // محاولة الحصول على رسالة خطأ من الخادم
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // تجاهل أخطاء تحليل JSON
      }

      throw new Error(errorMessage);
    }

    return response;
  } catch (error) {
    // معالجة أخطاء الشبكة
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('فشل في الاتصال بالخادم. تحقق من اتصال الإنترنت.');
    }

    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey, meta }) => {
        const url = queryKey[0] as string;

        // Validate URL before making request
        if (!url || url.includes('undefined')) {
          throw new Error('Invalid URL detected');
        }

        const response = await fetch(url, {
          credentials: "include", // استخدام session cookies لـ Replit Auth
          headers: {
            'Content-Type': 'application/json',
          },
          ...(meta as RequestInit),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      },
      // Set global defaults for better performance
      staleTime: 30000, // 30 seconds - data is considered fresh
      gcTime: 300000, // 5 minutes - keep data in cache
      refetchOnWindowFocus: false, // Disable refetch on window focus
      refetchOnReconnect: 'always', // Refetch when internet reconnects
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors
        if (error.message.includes('401') || error.message.includes('403')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});