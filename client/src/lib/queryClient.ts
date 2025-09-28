import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { getApiBaseUrl } from "../../../shared/environment";

// Use relative URLs to avoid SSL issues with IP addresses
const API_BASE = `${getApiBaseUrl()}/api`;

const apiLog = (action: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [API ${timestamp}] ${action}:`, data || '');
};

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
    const startTime = performance.now();
    const response = await fetch(fullUrl, config);
    const endTime = performance.now();
    const duration = endTime - startTime;

    apiLog('Request Completed', {
      method,
      endpoint: fullUrl, // Using fullUrl here for more detailed logging
      status: response.status,
      statusText: response.statusText,
      duration: `${duration.toFixed(2)}ms`,
      success: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      apiLog('Request Failed', {
        method,
        endpoint: fullUrl, // Using fullUrl here for more detailed logging
        status: response.status,
        statusText: response.statusText,
        duration: `${duration.toFixed(2)}ms`,
        url: fullUrl
      });

      // محاولة الحصول على رسالة خطأ من الخادم
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails = '';
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.error) {
          errorDetails = errorData.error;
        }
      } catch {
        try {
          errorDetails = await response.text();
        } catch {
          // Ignore errors reading text
        }
      }
      const fullError = errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage;
      console.error('❌ API Error:', fullError);
      throw new Error(fullError);
    }

    return response;
  } catch (error) {
    apiLog('Request Error', {
      method,
      endpoint: fullUrl, // Using fullUrl here for more detailed logging
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: fullUrl
    });
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
  async ({ queryKey, signal }) => { // Added signal to queryFn
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

    console.log(`Fetching: ${fullUrl}`); // Logging the fetch URL

    try {
      const res = await fetch(fullUrl, {
        signal, // Pass the signal to fetch
        credentials: "include",
      });

      console.log(`Response status for ${fullUrl}: ${res.status}`);

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log(`Unauthorized response for: ${fullUrl}`);
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Success response for ${fullUrl}:`, data);
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`Fetch aborted for ${fullUrl}`);
        throw error; // Re-throw abort errors
      }
      console.error(`Query error for ${fullUrl}:`, error);
      throw error;
    }
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