import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = "حدث خطأ غير متوقع";
    
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorMessage;
    } catch (jsonError) {
      // إذا فشل تحليل JSON، استخدم رسائل افتراضية حسب status code
      if (res.status === 400) {
        errorMessage = "البيانات المدخلة غير صحيحة";
      } else if (res.status === 404) {
        errorMessage = "العنصر المطلوب غير موجود";
      } else if (res.status === 500) {
        errorMessage = "حدث خطأ في الخادم";
      } else {
        errorMessage = "حدث خطأ في الاتصال";
      }
    }
    
    throw new Error(errorMessage);
  }
}

// ✅ تم نقل إدارة التوكنات إلى AuthProvider - سيتم ربطها لاحقاً
let authProviderHelpers: {
  getAccessToken: () => string | null;
  refreshToken: () => Promise<boolean>;
  logout: () => Promise<void>;
} | null = null;

// تسجيل helpers من AuthProvider
export function registerAuthHelpers(helpers: typeof authProviderHelpers) {
  authProviderHelpers = helpers;
}

// دالة مساعدة للحصول على التوكن
function getStoredAccessToken(): string | null {
  if (authProviderHelpers) {
    return authProviderHelpers.getAccessToken();
  }
  // fallback للتوافق المؤقت
  return localStorage.getItem('accessToken');
}

// دالة تجديد التوكن - تستخدم AuthProvider الآن
async function refreshAuthToken(): Promise<boolean> {
  if (authProviderHelpers) {
    return await authProviderHelpers.refreshToken();
  }
  
  // fallback للتوافق المؤقت
  console.warn('⚠️ AuthProvider helpers غير مسجلة - استخدام fallback');
  return false;
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<any> {
  // إضافة timeout 30 ثانية للطلبات
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  async function makeRequest(retryCount = 0): Promise<any> {
    try {
      // جمع headers مع Authorization إذا كان متوفراً
      const headers: Record<string, string> = {};
      if (data) {
        headers["Content-Type"] = "application/json";
      }
      
      // إضافة رمز المصادقة إذا كان متوفراً
      const accessToken = getStoredAccessToken();
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
        signal: controller.signal,
      });

      // التعامل مع خطأ 401 (انتهاء صلاحية التوكن)
      if (res.status === 401 && retryCount === 0) {
        console.log('🔄 محاولة تجديد التوكن...');
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          console.log('✅ تم تجديد التوكن، محاولة الطلب مرة أخرى...');
          return makeRequest(1); // إعادة المحاولة مرة واحدة فقط
        } else {
          console.log('❌ فشل في تجديد التوكن');
          // استخدام logout من AuthProvider
          if (authProviderHelpers) {
            await authProviderHelpers.logout();
          } else {
            window.location.href = '/login';
          }
          throw new Error('انتهت جلسة المصادقة، يرجى تسجيل الدخول مرة أخرى');
        }
      }

      await throwIfResNotOk(res);
      
      // إذا كانت استجابة DELETE فارغة، لا نحاول تحليل JSON
      if (method === "DELETE" && res.status === 204) {
        return {};
      }
      
      // ✅ تحسين معالجة JSON - فحص content-type أولاً
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await res.text();
        console.error(`❌ [apiRequest] الخادم أرسل ${contentType || 'غير محدد'} بدلاً من JSON:`, {
          url,
          method,
          status: res.status,
          contentType,
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`خطأ في نوع الاستجابة: متوقع JSON لكن تم استلام ${contentType || 'غير محدد'}`);
      }
      
      // ✅ إصلاح: استخدام clone لتجنب قراءة body مرتين
      let jsonData;
      try {
        jsonData = await res.json();
      } catch (parseError) {
        // استخدام clone للحصول على نسخة من response قبل قراءة الـ text
        const responseText = await res.clone().text();
        console.error(`❌ [apiRequest] خطأ في تحليل JSON:`, {
          url,
          method,
          parseError,
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error(`خطأ في تحليل استجابة JSON من الخادم`);
      }
      
      // تسجيل للتتبع والتشخيص
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 [apiRequest] ${method} ${url} - البيانات المستلمة:`, {
          hasSuccess: jsonData?.success !== undefined,
          hasData: jsonData?.data !== undefined,
          dataType: typeof jsonData?.data,
          isDataArray: Array.isArray(jsonData?.data),
          actualData: jsonData
        });
      }
      
      return jsonData;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('انتهت مهلة الطلب، يرجى المحاولة مرة أخرى');
      }
      throw error;
    }
  }

  try {
    const result = await makeRequest();
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    
    async function makeQueryRequest(retryCount = 0): Promise<any> {
      // إعداد timeout للطلب
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        // إعداد headers مع Authorization
        const headers: Record<string, string> = {};
        const accessToken = getStoredAccessToken();
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }

        console.log(`🔍 [QueryClient] إرسال طلب: ${queryKey.join("/")}`, {
          hasToken: !!accessToken
        });

        const res = await fetch(queryKey.join("/") as string, {
          headers,
          credentials: "include",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

      // التعامل مع خطأ 401 - إظهار السبب الحقيقي
        if (res.status === 401) {
          console.error(`🚫 [QueryClient] خطأ 401 غير مصرح لـ ${queryKey.join("/")}`, { 
            retryCount,
            hasToken: !!localStorage.getItem('accessToken'),
            queryKey: queryKey.join("/")
          });
          
          // ❌ إزالة returnNull التي تُخفي الأخطاء الحقيقية
          // if (unauthorizedBehavior === "returnNull") {
          //   return null as any;
          // }
          
          // محاولة تجديد التوكن إذا كانت المحاولة الأولى
          if (retryCount === 0) {
            console.log('🔄 محاولة تجديد التوكن في query...');
            const refreshed = await refreshAuthToken();
            if (refreshed) {
              console.log('✅ تم تجديد التوكن، إعادة تشغيل query...');
              return makeQueryRequest(1);
            }
          }
          
          // إذا فشل التجديد - إظهار الخطأ الحقيقي بدلاً من إخفاءه
          console.error('❌ فشل المصادقة - إظهار الخطأ الحقيقي');
          throw new Error(`خطأ في المصادقة (401): ${queryKey.join("/")} - يرجى تسجيل الدخول مرة أخرى`);
        }

        await throwIfResNotOk(res);
        const data = await res.json();
        
        console.log(`✅ [QueryClient] استجابة ناجحة لـ ${queryKey.join("/")}:`, {
          hasData: !!data,
          dataType: typeof data
        });
      
        // تسجيل مبسط في بيئة التطوير فقط
        if (process.env.NODE_ENV === 'development') {
          console.log(`📊 ${queryKey[0]} - تم استلام البيانات بنجاح`);
          
          // إضافة debugging خاص للإشعارات - مع guard للأمان
          if (typeof queryKey[0] === 'string' && queryKey[0].includes('notifications')) {
            console.log('🔍 [DEBUG] تفاصيل استجابة الإشعارات:', {
              dataType: typeof data,
              isArray: Array.isArray(data),
              dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
              dataContent: data
            });
          }
        }

        // 🔍 تشخيص مفصل للبيانات المستلمة
        console.log(`📊 [QueryClient] تحليل البيانات لـ ${queryKey.join("/")}:`, {
          dataType: typeof data,
          isObject: data && typeof data === 'object',
          hasSuccess: data?.success !== undefined,
          hasDataProperty: data?.data !== undefined,
          actualDataValue: data?.data,
          rawData: data
        });

        // استخراج البيانات الفعلية دون إجبار على مصفوفة فارغة
        if (data && typeof data === 'object') {
          // للتحقق من endpoints الهجرة التي تُرجع objects
          const isMigrationEndpoint = typeof queryKey[0] === 'string' && queryKey[0].includes('migration');
          
          // إذا كانت البيانات في الشكل { success, data, count } (شكل API)
          if (data.success !== undefined && data.data !== undefined) {
            console.log(`✅ [QueryClient] بيانات API صحيحة لـ ${queryKey.join("/")}:`, {
              success: data.success,
              dataExists: data.data !== null,
              dataType: typeof data.data,
              isArray: Array.isArray(data.data)
            });
            
            // لنقاط النهاية الخاصة بالهجرة، نُرجع البيانات كما هي
            if (isMigrationEndpoint) {
              return data.data; // إرجاع البيانات كما هي (object أو array)
            }
            
            // ✅ إصلاح جذري: إرجاع البيانات كما هي دون تعديل
            // إذا كانت null أو undefined فقط، إرجاع مصفوفة فارغة
            if (data.data === null || data.data === undefined) {
              console.warn(`⚠️ [QueryClient] البيانات null/undefined لـ ${queryKey.join("/")} - إرجاع مصفوفة فارغة`);
              return [];
            }
            
            return data.data; // إرجاع البيانات الحقيقية كما هي
          }
          
          // إذا كانت البيانات مصفوفة مباشرة (شكل Replit)
          if (Array.isArray(data)) {
            console.log(`📋 [QueryClient] مصفوفة مباشرة لـ ${queryKey.join("/")}:`, data.length);
            return data;
          }
          
          // إذا كان لديها خاصية data مباشرة
          if (data.data !== undefined) {
            console.log(`🔗 [QueryClient] خاصية data مباشرة لـ ${queryKey.join("/")}:`, data.data);
            return data.data !== null ? data.data : [];
          }
        }
        
        console.log(`🔄 [QueryClient] إرجاع البيانات كما هي لـ ${queryKey.join("/")}:`, data);
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`⏰ [QueryClient] timeout لـ ${queryKey.join("/")}`);
          throw new Error('انتهت مهلة الطلب، يرجى المحاولة مرة أخرى');
        }
        
        console.error(`❌ [QueryClient] خطأ في ${queryKey.join("/")}`, error);
        throw error;
      }
    }

    return makeQueryRequest();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // تقليل إعادة التحميل
      staleTime: 1000 * 60 * 15, // 15 دقيقة للتخزين المؤقت
      retry: 1, // محاولة واحدة إضافية عند الفشل
      refetchOnReconnect: false, // منع إعادة التحميل عند الاتصال
    },
    mutations: {
      retry: 1, // تقليل المحاولات
    },
  },
});
