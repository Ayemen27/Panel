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
  options: RequestOptions = {}
): Promise<Response> {
  const { timeout = 30000, retries = 2, skipCredentials = false } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint}`;

  // الحصول على التوكن من localStorage
  const token = localStorage.getItem('authToken');

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // إضافة التوكن إلى الهيدر إذا كان متوفراً
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    },
    credentials: skipCredentials ? 'omit' : 'include'
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    config.body = JSON.stringify(data);
  }

  if (method === 'GET' && data) {
    const params = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      const separator = url.includes('?') ? '&' : '?';
      return fetchWithRetry(`${url}${separator}${queryString}`, config, { timeout, retries });
    }
  }

  return fetchWithRetry(url, config, { timeout, retries });
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

// Dummy fetchWithRetry and RequestOptions for compilation
async function fetchWithRetry(url: string, config: RequestInit, options: { timeout: number, retries: number }): Promise<Response> {
  return fetch(url, config);
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  skipCredentials?: boolean;
  headers?: Record<string, string>;
}