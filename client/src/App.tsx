import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, lazy, Suspense } from "react";
import NotFound from "@/pages/not-found";
import MainLayout from "@/components/Layout/MainLayout";
import { AdminOnly, ModeratorAndAbove } from "@/components/auth/RoleGuard";

// Critical components loaded immediately
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Applications from "@/pages/Applications";

// Less critical components loaded lazily for better initial performance
const ApplicationLogs = lazy(() => import("@/pages/ApplicationLogs"));
const Domains = lazy(() => import("@/pages/Domains"));
const Nginx = lazy(() => import("@/pages/Nginx"));
const SSL = lazy(() => import("@/pages/SSL"));
const Processes = lazy(() => import("@/pages/Processes"));
const Logs = lazy(() => import("@/pages/Logs"));
const Terminal = lazy(() => import("@/pages/Terminal"));
const HealthCheck = lazy(() => import("@/pages/HealthCheck"));
const FileManager = lazy(() => import("@/pages/FileManager"));
const PathManager = lazy(() => import("@/pages/PathManager"));

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>
);

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // إذا كان التحميل جارياً، عرض loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        // المستخدم غير مسجل دخول - إظهار صفحة تسجيل الدخول فقط
        <Route>
          <AuthPage />
        </Route>
      ) : (
        // المستخدم مسجل دخول - إظهار الصفحات المحمية
        <>
          <Route path="/">
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </Route>
          <Route path="/dashboard">
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </Route>
          <Route path="/applications">
            <MainLayout>
              <Applications />
            </MainLayout>
          </Route>
          <Route path="/applications/logs/:id">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <ApplicationLogs />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/domains">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <Domains />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/nginx">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <Nginx />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/ssl">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <SSL />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/processes">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <Processes />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/logs">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <Logs />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/terminal">
            <MainLayout>
              <AdminOnly>
                <Suspense fallback={<PageLoader />}>
                  <Terminal />
                </Suspense>
              </AdminOnly>
            </MainLayout>
          </Route>
          <Route path="/health-check">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <HealthCheck />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/files">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <FileManager />
              </Suspense>
            </MainLayout>
          </Route>
          <Route path="/admin/paths">
            <MainLayout>
              <AdminOnly>
                <Suspense fallback={<PageLoader />}>
                  <PathManager />
                </Suspense>
              </AdminOnly>
            </MainLayout>
          </Route>
        </>
      )}
    </Switch>
  );
}

function App() {
  // معالج أخطاء عام لـ JavaScript
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      // يمكن إضافة معالجة إضافية هنا
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // منع إظهار الخطأ في وحدة التحكم
      event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <NotificationProvider>
            <Toaster />
            <Router />
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;