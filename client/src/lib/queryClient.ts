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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<Response> {
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...options?.headers,
    },
    credentials: 'include',
    ...options,
  };

  let fullUrl = endpoint;

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  } else if (data && method === 'GET') {
    const params = new URLSearchParams();
    
    // Handle nested objects in query parameters
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, String(value));
      }
    });
    
    const separator = endpoint.includes('?') ? '&' : '?';
    fullUrl = `${endpoint}${separator}${params.toString()}`;
  }

  console.log(`🌐 ${method} ${fullUrl}`);

  try {
    const response = await fetch(fullUrl, config);

    console.log(`📡 Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = '';

      // محاولة الحصول على رسالة خطأ من الخادم
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.error) {
          errorDetails = errorData.error;
        }
      } catch {
        // إذا فشل تحليل JSON، استخدم النص
        try {
          errorDetails = await response.text();
        } catch {
          // تجاهل أخطاء قراءة النص
        }
      }

      const fullError = errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage;
      console.error('❌ API Error:', fullError);
      throw new Error(fullError);
    }

    return response;
  } catch (error) {
    console.error('❌ Network/Fetch Error:', error);
    
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

// Using native fetch API with proper session configuration

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey, signal }) => {
        const [path] = queryKey as [string];

        console.log('Fetching:', path);

        try {
          const res = await fetch(path, {
            signal,
            credentials: 'include', // ✅ ضروري لإرسال cookies/session
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });

          console.log('Response status for', path, ':', res.status);

          if (!res.ok) {
            if (res.status === 401) {
              console.log('Unauthorized response for:', path);
              throw new Error('401: Unauthorized');
            }

            let errorMessage = `HTTP ${res.status}`;
            try {
              const errorData = await res.json();
              errorMessage = errorData.message || errorMessage;
            } catch {
              // If JSON parsing fails, use the status text
              errorMessage = res.statusText || errorMessage;
            }

            console.error('API Error:', errorMessage);
            throw new Error(errorMessage);
          }

          const data = await res.json();
          console.log('Success response for', path, ':', data);
          return data;
        } catch (error) {
          // Network errors or other fetch errors
          if (error instanceof Error && error.name === 'AbortError') {
            throw error; // Re-throw abort errors
          }

          console.error(`Query error for ${path}:`, error);
          throw error;
        }
      },
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // إذا كان الخطأ 401 (Unauthorized) أو 500، لا تعيد المحاولة
        if (error instanceof Error && (
          error.message.includes('401') || 
          error.message.includes('500') ||
          error.message.includes('Unauthorized') ||
          error.message.includes('Internal Server Error')
        )) {
          console.log('🚫 Authentication/Server error - not retrying query:', error.message);
          return false;
        }
        return failureCount < 2; // قلل عدد المحاولات
      },
    },
  },
});