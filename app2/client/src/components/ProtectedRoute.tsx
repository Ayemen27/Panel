/**
 * مكون حماية الصفحات - يحمي الصفحات من الوصول غير المصرح به
 */

import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { ProfessionalLoader } from "./ui/professional-loader";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // فحص إضافي للتأكد من وجود بيانات محفوظة
  const hasStoredAuth = typeof window !== 'undefined' &&
    localStorage.getItem('user') &&
    localStorage.getItem('accessToken');

  console.log('🛡️ [ProtectedRoute] فحص الحماية:', {
    isLoading,
    isAuthenticated,
    hasStoredAuth,
    userEmail: user?.email || 'غير موجود',
    authCheckComplete,
    timestamp: new Date().toISOString()
  });

  // انتظار تحميل AuthProvider لفترة معقولة
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setAuthCheckComplete(true);
      }, 1000); // انتظار ثانية واحدة للتأكد من تحميل البيانات

      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // إظهار شاشة التحميل أثناء التحقق من المصادقة
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <ProfessionalLoader />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  // منع الوصول للمستخدمين غير المتحققين من البريد الإلكتروني
  if (user && !user.emailVerified) {
    console.log('🚫 [ProtectedRoute] مستخدم غير متحقق من البريد، توجيه للتحقق');
    return <Redirect to={`/verify-email?userId=${user.id}&email=${encodeURIComponent(user.email)}`} />;
  }

  // إذا كان مصادق عليه، اسمح بالدخول مع حماية من الأخطاء
  if (isAuthenticated && user) {
    console.log('✅ [ProtectedRoute] مصادق عليه، إظهار المحتوى للمستخدم:', user.email);
    try {
      return <>{children}</>;
    } catch (error) {
      console.error('❌ [ProtectedRoute] خطأ في تحميل المحتوى:', error);
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              خطأ في تحميل الصفحة
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              حدث خطأ أثناء تحميل المحتوى. يرجى إعادة تحميل الصفحة.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              إعادة تحميل
            </button>
          </div>
        </div>
      );
    }
  }

  // إذا كانت هناك بيانات محفوظة ولكن لم يتم تحميل المستخدم، محاولة أخيرة
  if (hasStoredAuth && !user && authCheckComplete) {
    console.log('⚠️ [ProtectedRoute] بيانات محفوظة موجودة لكن المستخدم غير محمل، إعادة المحاولة...');

    try {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        if (parsedUser && parsedUser.email) {
          console.log('✅ [ProtectedRoute] تم استرجاع بيانات المستخدم من localStorage');
          return <>{children}</>;
        }
      }
    } catch (error) {
      console.error('❌ [ProtectedRoute] خطأ في استرجاع بيانات المستخدم من localStorage:', error);
    }
  }

  // فقط إعادة التوجيه إذا لم يكن هناك أي بيانات مصادقة نهائياً
  if (!isAuthenticated && !hasStoredAuth && authCheckComplete) {
    console.log('🚫 [ProtectedRoute] لا توجد بيانات مصادقة، إعادة توجيه إلى /login');
    return <Redirect to="/login" />;
  }

  // في حالة وجود بيانات محفوظة لكن المصادقة فاشلة، تنظيف البيانات وإعادة التوجيه
  if (hasStoredAuth && !isAuthenticated && authCheckComplete) {
    console.log('🧹 [ProtectedRoute] تنظيف البيانات الفاسدة وإعادة التوجيه');
    localStorage.removeItem('user');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return <Redirect to="/login" />;
  }

  // حالة افتراضية - إظهار شاشة التحميل
  console.log('⏳ [ProtectedRoute] حالة افتراضية، إظهار شاشة التحميل');
  return (
    <div className="min-h-screen flex items-center justify-center">
      <ProfessionalLoader />
    </div>
  );
}