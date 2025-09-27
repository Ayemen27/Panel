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
  data?: any,
  options: RequestInit = {}
): Promise<Response> {
  // تحقق من نوع الطلب وإزالة body للطلبات GET و HEAD
  const isGetOrHead = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';

  // إعداد URL مع query parameters للطلبات GET
  let url = endpoint;
  if (isGetOrHead && data && typeof data === 'object') {
    const params = new URLSearchParams();
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        params.append(key, String(data[key]));
      }
    });
    if (params.toString()) {
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }
  }

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  };

  // إضافة body فقط للطلبات غير GET/HEAD
  if (data && !isGetOrHead) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);

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
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
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
        if (error instanceof Error && error.message === 'Unauthorized') {
          console.log('Not retrying unauthorized error');
          return false;
        }
        console.log('Retrying query, attempt:', failureCount + 1);
        return failureCount < 3;
      },
    },
  },
});