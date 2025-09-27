import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { ActivityProvider } from "@/contexts/ActivityContext";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { runWebSocketDiagnostics } from "@/utils/websocketDiagnostics";
import { useEffect, lazy, Suspense } from "react";
import { errorLogger, updateAppState } from "@/lib/errorLogger";
import NotFound from "@/pages/not-found";
import MainLayout from "@/components/Layout/MainLayout";
import { AdminOnly, ModeratorAndAbove } from "@/components/auth/RoleGuard";

// Critical components loaded immediately
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Applications from "@/pages/Applications";

// Less critical components loaded lazily for better initial performance
const ApplicationLogs = lazy(() =>
  import("@/pages/ApplicationLogs").then(module => ({ default: module.default }))
);
const Domains = lazy(() =>
  import("@/pages/Domains").then(module => ({ default: module.default }))
);
const Nginx = lazy(() =>
  import("@/pages/Nginx").then(module => ({ default: module.default }))
);
const SSL = lazy(() =>
  import("@/pages/SSL").then(module => ({ default: module.default }))
);
const Processes = lazy(() =>
  import("@/pages/Processes").then(module => ({ default: module.default }))
);
const Logs = lazy(() =>
  import("@/pages/Logs").then(module => ({ default: module.default }))
);
const ComprehensiveAudit = lazy(() =>
  import("./pages/ComprehensiveAudit").then(module => ({ default: module.default }))
);
const Terminal = lazy(() =>
  import("@/pages/Terminal").then(module => ({ default: module.default }))
);
const HealthCheck = lazy(() =>
  import("@/pages/HealthCheck").then(module => ({ default: module.default }))
);
const FileManager = lazy(() =>
  import("@/pages/FileManager").then(module => ({ default: module.default }))
);
const PathManager = lazy(() =>
  import("@/pages/PathManager").then(module => ({ default: module.default }))
);

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
  const { isAuthenticated, isLoading, user } = useAuth();
  const { isConnected: wsConnected, connectionDiagnostics } = useWebSocket(user?.id);

  console.log('Router - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  // إذا كان التحميل جارياً، عرض loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground text-lg">جاري التحميل...</p>
          <p className="text-xs text-muted-foreground mt-2">يرجى الانتظار...</p>
        </div>
      </div>
    );
  }

  // If authentication state is still loading, show loading screen
  if (isAuthenticated === undefined) {
    console.log('Authentication state loading, showing Loading');
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground text-lg">جاري التحقق من المصادقة...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show auth page
  if (!isAuthenticated) {
    console.log('User not authenticated, showing AuthPage');
    return <AuthPage />;
  }

  // If user is authenticated, show protected routes
  console.log('User authenticated, showing protected routes');

  // تشغيل تشخيص WebSocket عند التحميل
  useEffect(() => {
    if (user?.id) {
      runWebSocketDiagnostics(user.id).then(diagnostics => {
        console.log('🔍 WebSocket diagnostics completed:', diagnostics);
        if (!diagnostics.success) {
          console.warn('⚠️ WebSocket connection issues detected');
        }
      });
    }
  }, [user?.id]);

  // Define protected routes. These routes require authentication.
  const protectedRoutes = [
    "/",
    "/dashboard",
    "/applications",
    "/applications/logs/:id",
    "/domains",
    "/nginx",
    "/ssl",
    "/processes",
    "/logs",
    "/audit",
    "/terminal",
    "/health-check",
    "/file-manager",
    "/path-manager",
  ];

  // Check current location
  const location = window.location;

  // If the current route is protected and the user is not authenticated, redirect to login.
  if (protectedRoutes.includes(location.pathname) && !isAuthenticated) {
    console.log('Protected route accessed without authentication, redirecting to AuthPage');
    return <AuthPage />;
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
          <Route path="/audit">
            <MainLayout>
              <Suspense fallback={<PageLoader />}>
                <ComprehensiveAudit />
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
          <Route path="/file-manager">
            <Suspense fallback={<PageLoader />}>
              <FileManager />
            </Suspense>
          </Route>
          <Route path="/path-manager">
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
  // تهيئة نظام تسجيل الأخطاء
  useEffect(() => {
    // تحديث حالة التطبيق عند بداية التطبيق
    updateAppState({
      appInitialized: true,
      initTime: new Date().toISOString(),
      environment: import.meta.env.MODE,
      version: '1.0.0'
    });

    console.log('🔍 ErrorLogger system initialized in App.tsx');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <NotificationProvider>
              <ActivityProvider enableByDefault={true}>
                <Toaster />
                <Router />
              </ActivityProvider>
            </NotificationProvider>
          </TooltipProvider>
        </ThemeProvider>
      </ErrorProvider>
    </QueryClientProvider>
  );
}

export default App;