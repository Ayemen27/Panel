/**
 * موفر السياق للمصادقة
 * يوفر حالة المصادقة وإدارة الجلسات
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { registerAuthHelpers } from "../lib/queryClient";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  // ✅ Helper functions لإدارة التوكنات
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const isAuthenticated = user !== null;

  // ✅ Helper functions لإدارة التوكنات - مركزية وآمنة
  const getAccessToken = (): string | null => {
    return localStorage.getItem('accessToken');
  };

  const getRefreshToken = (): string | null => {
    return localStorage.getItem('refreshToken');
  };

  // متغيرات لإدارة Fallback mechanisms
  const [authFailureCount, setAuthFailureCount] = useState(0);
  const [lastAuthCheck, setLastAuthCheck] = useState<Date | null>(null);

  // تسجيل helpers مع queryClient
  useEffect(() => {
    registerAuthHelpers({
      getAccessToken,
      refreshToken,
      logout
    });
  }, []); // تشغيل مرة واحدة فقط

  // تحقق من وجود مستخدم محفوظ عند بدء التطبيق مع آليات تعافي محسنة
  useEffect(() => {
    const initAuth = async () => {
      console.log('🔐 [AuthProvider] بدء تهيئة المصادقة...', new Date().toISOString());
      try {
        const savedUser = localStorage.getItem('user');
        const accessToken = localStorage.getItem('accessToken');

        console.log('🔍 [AuthProvider] فحص البيانات المحفوظة:', {
          hasUser: !!savedUser,
          hasToken: !!accessToken,
          userPreview: savedUser ? `${savedUser.substring(0, 50)}...` : 'غير موجود',
          authFailureCount: authFailureCount
        });

        // ✅ إصلاح: التحقق الدقيق من البيانات المحفوظة
        if (savedUser && accessToken) {
          console.log('📦 [AuthProvider] وُجدت بيانات محفوظة، محاولة التحقق...');
          try {
            // محاولة تحليل بيانات المستخدم
            const parsedUser = JSON.parse(savedUser);
            console.log('👤 [AuthProvider] تم تحليل بيانات المستخدم:', {
              id: parsedUser.id,
              email: parsedUser.email
            });

            // ✅ التحقق من صحة التوكن مع الخادم
            console.log('🔍 [AuthProvider] التحقق من صحة التوكن مع الخادم...');
            const response = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              credentials: 'include'
            });

            console.log('📡 [AuthProvider] استجابة التحقق:', {
              status: response.status,
              ok: response.ok
            });

            if (response.ok) {
              const responseData = await response.json();
              console.log('✅ [AuthProvider] بيانات الاستجابة:', responseData);

              if (responseData.success && responseData.user) {
                console.log('✅ [AuthProvider] تم التحقق من البيانات بنجاح:', {
                  userId: responseData.user.id,
                  email: responseData.user.email
                });
                setUser(responseData.user);
                setLastAuthCheck(new Date());
                setAuthFailureCount(0); // إعادة تعيين عداد الأخطاء
              } else {
                throw new Error('بيانات المستخدم غير صحيحة في الاستجابة');
              }
            } else if (response.status === 401) {
              // في حالة 401، المستخدم بحاجة لتسجيل دخول جديد
              console.log('🚫 [AuthProvider] التوكن منتهي الصلاحية، تسجيل خروج تلقائي');
              // تنظيف البيانات
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setUser(null);
              // لا نعيد توجيه هنا، سيتم التعامل معه في ProtectedRoute
            } else {
              console.log(`⚠️ [AuthProvider] فشل التحقق: ${response.status}`);

              // ✅ محاولة تجديد التوكن عند 401
              const refreshTokenValue = localStorage.getItem('refreshToken');
              if (response.status === 401 && refreshTokenValue) {
                console.log('🔄 [AuthProvider] محاولة تجديد التوكن...');
                const refreshResponse = await fetch('/api/auth/refresh', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken: refreshTokenValue }),
                  credentials: 'include'
                });

                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json();
                  if (refreshData.success && refreshData.tokens) {
                    console.log('✅ [AuthProvider] تم تجديد التوكن بنجاح');
                    localStorage.setItem('accessToken', refreshData.tokens.accessToken);
                    localStorage.setItem('refreshToken', refreshData.tokens.refreshToken);
                    // تعيين المستخدم مباشرة
                    setUser(parsedUser);
                    setAuthFailureCount(0);
                    return;
                  }
                }
                console.log('❌ [AuthProvider] فشل تجديد التوكن');
              }

              throw new Error(`HTTP ${response.status}: فشل التحقق من المصادقة`);
            }
          } catch (error) {
            console.error('❌ [AuthProvider] خطأ في التحقق من البيانات:', error);
            const newFailureCount = authFailureCount + 1;
            setAuthFailureCount(newFailureCount);

            // مسح البيانات إذا تكررت الأخطاء (تساهل أكثر)
            if (newFailureCount >= 3) {
              console.log('🧹 [AuthProvider] مسح البيانات بسبب تكرار الأخطاء');
              localStorage.removeItem('user');
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              setUser(null);
            } else {
              console.log(`⏳ [AuthProvider] إبقاء البيانات، محاولة ${newFailureCount}/3`);
            }
          }
        } else {
          console.log('ℹ️ [AuthProvider] لا توجد بيانات محفوظة', {
            hasSavedUser: !!savedUser,
            hasAccessToken: !!accessToken
          });
        }
      } catch (error) {
        console.error('❌ [AuthProvider] خطأ عام في تحقق المصادقة:', error);
        // في حالة خطأ عام، لا نفعل شيء جذري - نتركه للمستخدم
      } finally {
        console.log('🏁 [AuthProvider] انتهاء تهيئة المصادقة، isLoading = false');
        setIsLoading(false);
      }
    };

    initAuth();
  }, [authFailureCount]); // إعادة تشغيل عند تغير عداد الفشل

  // تسجيل الدخول
  const login = async (email: string, password: string) => {
    console.log('🔑 [AuthProvider.login] بدء تسجيل الدخول:', email, new Date().toISOString());
    console.log('📊 [AuthProvider.login] معاملات الدخل:', {
      email: email,
      hasPassword: !!password,
      passwordLength: password?.length || 0,
      isLoading: isLoading,
      isAuthenticated: isAuthenticated,
      currentUser: user?.email || 'لا يوجد'
    });

    try {
      console.log('📡 [AuthProvider.login] إرسال طلب لـ /api/auth/login...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        // في حالة عدم التحقق من البريد الإلكتروني (403)
        if (response.status === 403 && result.requireEmailVerification) {
          const error = new Error(result.message || 'يجب التحقق من البريد الإلكتروني أولاً');
          (error as any).requireEmailVerification = true;
          (error as any).userId = result.data?.userId;
          (error as any).email = result.data?.email;
          throw error;
        }
        throw new Error(result.message || 'فشل تسجيل الدخول');
      }

      // استخراج بيانات المستخدم بشكل صحيح
      const userData = result.data?.user || result.user;
      const tokenData = result.data?.tokens?.accessToken || result.data?.accessToken || result.tokens?.accessToken || result.accessToken || result.token;
      const refreshTokenData = result.data?.tokens?.refreshToken || result.data?.refreshToken || result.tokens?.refreshToken || result.refreshToken;

      console.log('🔍 [AuthProvider.login] فحص البيانات المستخرجة:', {
        hasUserData: !!userData,
        hasToken: !!tokenData,
        hasRefreshToken: !!refreshTokenData,
        userDetails: userData ? { id: userData.id, email: userData.email, name: userData.name } : 'none'
      });

      if (!userData) {
        console.error('❌ [AuthProvider.login] بيانات المستخدم مفقودة:', {
          userData: userData,
          dataStructure: result,
          possibleUserPaths: [
            'data.user',
            'user'
          ]
        });
        throw new Error('بيانات المستخدم مفقودة من استجابة الخادم');
      }

      if (!tokenData) {
        console.error('❌ [AuthProvider.login] الرمز المميز مفقود:', {
          hasToken: !!tokenData,
          dataStructure: result,
          possibleTokenPaths: [
            'data.accessToken',
            'tokens.accessToken',
            'accessToken'
          ]
        });
        throw new Error('الرمز المميز مفقود من استجابة الخادم');
      }

      // حفظ بيانات المستخدم
      const user = {
        id: userData.id,
        email: userData.email,
        name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
        role: userData.role || 'admin',
        mfaEnabled: userData.mfaEnabled || false,
        emailVerified: userData.emailVerified || true, // افتراضي true للمستخدمين المسجلين
      };

      console.log('👤 [AuthProvider.login] إعداد بيانات المستخدم:', user);
      console.log('👤 [AuthProvider.login] التحقق من صحة البيانات:', {
        hasId: !!user.id,
        hasEmail: !!user.email,
        hasName: !!user.name,
        hasRole: !!user.role
      });

      // التحقق من وجود البيانات الأساسية
      if (!user.id || !user.email) {
        console.error('❌ [AuthProvider.login] بيانات المستخدم الأساسية مفقودة:', user);
        throw new Error('بيانات المستخدم الأساسية مفقودة (ID أو البريد الإلكتروني)');
      }

      console.log('💾 [AuthProvider.login] بدء حفظ البيانات...');

      // حفظ المستخدم والتوكين
      console.log('💾 [AuthProvider.login] محاولة تعيين المستخدم في الحالة:', user);
      setUser(user);
      console.log('✅ [AuthProvider.login] تم تعيين المستخدم في الحالة بنجاح');
      console.log('🔍 [AuthProvider.login] التحقق من حالة المستخدم بعد التعيين:', {
        userSet: !!user,
        isAuthenticatedNow: !!user,
        userId: user?.id,
        userEmail: user?.email
      });

      try {
        const userJson = JSON.stringify(user);
        console.log('💾 [AuthProvider.login] محاولة حفظ بيانات المستخدم:', {
          userJsonLength: userJson.length,
          userJson: userJson.substring(0, 100) + '...'
        });
        localStorage.setItem('user', userJson);
        console.log('✅ [AuthProvider.login] تم حفظ بيانات المستخدم في localStorage بنجاح');
      } catch (storageError) {
        console.error('❌ [AuthProvider.login] فشل حفظ المستخدم في localStorage:', storageError);
        throw new Error('فشل في حفظ بيانات المستخدم محلياً');
      }

      try {
        console.log('💾 [AuthProvider.login] محاولة حفظ الرمز المميز:', {
          tokenLength: tokenData?.length || 0,
          tokenPreview: tokenData ? tokenData.substring(0, 20) + '...' : 'فارغ'
        });
        localStorage.setItem('accessToken', tokenData);
        console.log('✅ [AuthProvider.login] تم حفظ الرمز المميز بنجاح');
      } catch (storageError) {
        console.error('❌ [AuthProvider.login] فشل حفظ الرمز في localStorage:', storageError);
        throw new Error('فشل في حفظ الرمز المميز محلياً');
      }

      if (refreshTokenData) {
        localStorage.setItem('refreshToken', refreshTokenData);
        console.log('✅ [AuthProvider.login] تم حفظ رمز التجديد');
      }

      console.log('💾 [AuthProvider.login] تم حفظ جميع البيانات بنجاح');

      // التحقق من الحفظ
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('accessToken');
      console.log('🔍 [AuthProvider.login] تأكيد الحفظ:', {
        userSaved: !!savedUser,
        tokenSaved: !!savedToken,
        userInState: !!user
      });
      console.log('🔄 [AuthProvider.login] تحديث cache queries');

      queryClient.invalidateQueries();

      console.log('🎉 [AuthProvider.login] اكتمل تسجيل الدخول بنجاح');

      // إجبار إعادة تقييم حالة المصادقة فوراً
      console.log('🔄 [AuthProvider.login] إجبار تحديث حالة المصادقة...');

      // التأكد من أن المكونات الأخرى تتلقى التحديث
      setTimeout(() => {
        console.log('✅ [AuthProvider.login] تم تأكيد حالة المصادقة:', {
          isAuthenticated: !!user,
          userId: user?.id,
          userEmail: user?.email
        });
      }, 100);

    } catch (error) {
      console.error('❌ [AuthProvider.login] خطأ في تسجيل الدخول:', error);
      console.error('🚨 [AuthProvider.login] تفاصيل الخطأ الشامل:', {
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      console.error('❌ [AuthProvider.login] تفاصيل الخطأ:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'UnknownError'
      });

      // رمي خطأ واضح للمستخدم
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage && errorMessage.includes('غير مكتملة')) {
        throw error;
      } else if (errorMessage && errorMessage.includes('مفقود')) {
        throw error;
      } else {
        throw new Error('حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى');
      }
    }
  };

  // تسجيل الخروج
  const logout = async () => {
    try {
      console.log('🚪 [AuthProvider.logout] بدء عملية تسجيل الخروج...');

      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        console.log('📤 [AuthProvider.logout] إرسال طلب logout للخادم...');
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ [AuthProvider.logout] استجابة logout من الخادم:', result);
        } else {
          console.warn('⚠️ [AuthProvider.logout] فشل في logout من الخادم، سنتابع التنظيف المحلي');
        }
      } else {
        console.log('ℹ️ [AuthProvider.logout] لا يوجد access token، التنظيف المحلي فقط');
      }
    } catch (error) {
      console.error('❌ [AuthProvider.logout] خطأ في تسجيل الخروج:', error);
      console.warn('⚠️ [AuthProvider.logout] سنتابع التنظيف المحلي رغم الخطأ');
    } finally {
      console.log('🧹 [AuthProvider.logout] بدء التنظيف المحلي...');

      // تنظيف الحالة والتخزين المحلي
      setUser(null);
      console.log('✅ [AuthProvider.logout] تم مسح بيانات المستخدم من الحالة');

      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      console.log('✅ [AuthProvider.logout] تم مسح جميع البيانات من localStorage');

      queryClient.clear();
      console.log('✅ [AuthProvider.logout] تم مسح cache');

      console.log('🎉 [AuthProvider.logout] اكتمل تسجيل الخروج بنجاح');
    }
  };

  // متغيرات لإدارة إعادة المحاولة
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // دالة مساعدة للانتظار (sleep)
  const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

  // حساب delay للـ exponential backoff
  const calculateBackoffDelay = (attempt: number): number => {
    // بدءاً من 100ms، مضاعفة كل مرة، بحد أقصى 5s
    return Math.min(100 * Math.pow(2, attempt), 5000);
  };

  // تجديد الرمز المميز مع backoff strategy وتحسينات شاملة
  const refreshToken = async (forceRetry: boolean = false): Promise<boolean> => {
    console.log('🔄 [AuthProvider.refreshToken] بدء عملية تجديد الرمز...');

    // تجنب محاولات متزامنة متعددة
    if (isRefreshing && !forceRetry) {
      console.log('⏳ [AuthProvider.refreshToken] تجديد جارٍ بالفعل، انتظار...');
      // انتظار حتى انتهاء التجديد الجاري
      while (isRefreshing) {
        await sleep(100);
      }
      // التحقق من نجاح التجديد السابق
      return localStorage.getItem('accessToken') !== null;
    }

    setIsRefreshing(true);
    const startTime = Date.now();
    let currentAttempt = forceRetry ? 0 : refreshAttempts;

    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        console.log('❌ [AuthProvider.refreshToken] لا يوجد refresh token');
        return false;
      }

      // حد أقصى 3 محاولات
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const attemptStartTime = Date.now();
        console.log(`🔄 [AuthProvider.refreshToken] محاولة ${attempt + 1}/${maxAttempts}...`);

        try {
          // إنشاء AbortController للتحكم في timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.log(`⏰ [AuthProvider.refreshToken] timeout للمحاولة ${attempt + 1}`);
          }, 10000); // 10 ثواني timeout

          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken: refreshTokenValue }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          const attemptDuration = Date.now() - attemptStartTime;
          console.log(`📊 [AuthProvider.refreshToken] محاولة ${attempt + 1} استغرقت ${attemptDuration}ms`);

          // قراءة response مرة واحدة فقط
          const responseText = await response.text();
          let data;

          try {
            // محاولة parsing كـ JSON
            data = JSON.parse(responseText);
          } catch (parseError) {
            // إذا فشل parsing، استخدام النص كما هو
            console.log(`❌ [AuthProvider.refreshToken] فشل parsing JSON:`, responseText);
            data = { success: false, message: responseText };
          }

          if (response.ok && data.success && data.tokens) {
            console.log('📦 [AuthProvider.refreshToken] استجابة ناجحة:', { success: data.success, hasTokens: !!data.tokens });

            // نجحت العملية - حفظ الرموز الجديدة
            localStorage.setItem('accessToken', data.tokens.accessToken);
            localStorage.setItem('refreshToken', data.tokens.refreshToken);

            // إعادة تعيين عداد المحاولات
            setRefreshAttempts(0);

            const totalDuration = Date.now() - startTime;
            console.log(`✅ [AuthProvider.refreshToken] نجح التجديد في ${totalDuration}ms بعد ${attempt + 1} محاولة`);

            return true;
          } else {
            // فشل HTTP أو بيانات غير صحيحة
            console.log(`❌ [AuthProvider.refreshToken] فشل ${response.status}:`, data.message || responseText);
          }

          // إذا كان 401 أو 403، فالـ refresh token منتهي الصلاحية
          if (response.status === 401 || response.status === 403) {
            console.log('🚫 [AuthProvider.refreshToken] refresh token منتهي الصلاحية - لا فائدة من إعادة المحاولة');
            break; // خروج من حلقة المحاولات
          }

        } catch (error) {
          const attemptDuration = Date.now() - attemptStartTime;

          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              console.log(`⏰ [AuthProvider.refreshToken] timeout في المحاولة ${attempt + 1} بعد ${attemptDuration}ms`);
            } else {
              console.log(`🌐 [AuthProvider.refreshToken] خطأ شبكة في المحاولة ${attempt + 1}:`, error.message);
            }
          } else {
            console.log(`❓ [AuthProvider.refreshToken] خطأ غير معروف في المحاولة ${attempt + 1}:`, error);
          }
        }

        // إذا لم تكن هذه المحاولة الأخيرة، انتظر قبل المحاولة التالية
        if (attempt < maxAttempts - 1) {
          const delay = calculateBackoffDelay(attempt);
          console.log(`⏰ [AuthProvider.refreshToken] انتظار ${delay}ms قبل المحاولة التالية...`);
          await sleep(delay);
        }
      }

      // فشل جميع المحاولات
      setRefreshAttempts(prev => prev + 1);
      const totalDuration = Date.now() - startTime;
      console.log(`❌ [AuthProvider.refreshToken] فشل التجديد نهائياً بعد ${totalDuration}ms و${maxAttempts} محاولات`);

      return false;

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      console.error(`💥 [AuthProvider.refreshToken] خطأ عام بعد ${totalDuration}ms:`, error);
      setRefreshAttempts(prev => prev + 1);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
    getAccessToken,
    getRefreshToken,
  };

  // تسجيل helpers مع queryClient للتوحيد
  useEffect(() => {
    registerAuthHelpers({
      getAccessToken,
      refreshToken,
      logout,
    });
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// hook للحصول على رمز المصادقة مع التجديد التلقائي
export function useAuthenticatedRequest() {
  const { refreshToken } = useAuth();

  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const accessToken = localStorage.getItem('accessToken');

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': accessToken ? `Bearer ${accessToken}` : '',
      },
    });

    // إذا انتهت صلاحية الرمز
    if (response.status === 401 || response.status === 403) {
      const refreshed = await refreshToken();
      if (refreshed) {
        // إعادة المحاولة مع الرمز الجديد
        const newAccessToken = localStorage.getItem('accessToken');
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': newAccessToken ? `Bearer ${newAccessToken}` : '',
          },
        });
      }
    }

    return response;
  };
}