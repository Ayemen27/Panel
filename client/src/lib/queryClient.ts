import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Use relative URLs to avoid SSL issues with IP addresses
const API_BASE = window.location.origin;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Ensure we use the correct domain
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
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

        // إعداد الرؤوس
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // التحقق من وجود رمز مخصص
        const customToken = localStorage.getItem('customAuthToken');
        if (customToken) {
          headers['Authorization'] = `Bearer ${customToken}`;
        }

        const response = await fetch(url, {
          credentials: "include",
          headers,
          ...(meta as RequestInit),
        });

        if (!response.ok) {
          if (response.status === 401) {
            // محاولة تجديد الرمز إذا كان مخصصاً
            if (customToken) {
              const refreshToken = localStorage.getItem('customRefreshToken');
              if (refreshToken) {
                try {
                  const refreshResponse = await fetch('/api/custom-auth/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                  });

                  if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json();
                    if (refreshData.success && refreshData.accessToken) {
                      localStorage.setItem('customAuthToken', refreshData.accessToken);

                      // إعادة المحاولة مع الرمز الجديد
                      const retryResponse = await fetch(url, {
                        credentials: "include",
                        headers: {
                          ...headers,
                          'Authorization': `Bearer ${refreshData.accessToken}`,
                        },
                        ...(meta as RequestInit),
                      });

                      if (retryResponse.ok) {
                        return retryResponse.json();
                      }
                    }
                  }
                } catch (error) {
                  console.error('Token refresh failed:', error);
                }
              }

              // إذا فشل التجديد، امسح الرموز
              localStorage.removeItem('customAuthToken');
              localStorage.removeItem('customRefreshToken');
              localStorage.removeItem('currentUser');
            }

            throw new Error(`401: Unauthorized - ${response.statusText}`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      },
    },
    mutations: {
      retry: false,
    },
  },
});