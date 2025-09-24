import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Applications from "@/pages/Applications";
import ApplicationLogs from "@/pages/ApplicationLogs";
import Domains from "@/pages/Domains";
import Nginx from "@/pages/Nginx";
import SSL from "@/pages/SSL";
import Processes from "@/pages/Processes";
import Logs from "@/pages/Logs";
import Terminal from "@/pages/Terminal";
import HealthCheck from "@/pages/HealthCheck";
import MainLayout from "@/components/Layout/MainLayout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" exact>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </Route>
          <Route path="/dashboard">
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </Route>
          <Route path="/applications" exact>
            <MainLayout>
              <Applications />
            </MainLayout>
          </Route>
          <Route path="/applications/logs/:id">
            <MainLayout>
              <ApplicationLogs />
            </MainLayout>
          </Route>
          <Route path="/domains">
            <MainLayout>
              <Domains />
            </MainLayout>
          </Route>
          <Route path="/nginx">
            <MainLayout>
              <Nginx />
            </MainLayout>
          </Route>
          <Route path="/ssl">
            <MainLayout>
              <SSL />
            </MainLayout>
          </Route>
          <Route path="/processes">
            <MainLayout>
              <Processes />
            </MainLayout>
          </Route>
          <Route path="/logs">
            <MainLayout>
              <Logs />
            </MainLayout>
          </Route>
          <Route path="/terminal">
            <MainLayout>
              <Terminal />
            </MainLayout>
          </Route>
          <Route path="/health-check">
            <MainLayout>
              <HealthCheck />
            </MainLayout>
          </Route>
          <Route component={NotFound} />
        </>
      )}
      <Route component={NotFound} />
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
      <TooltipProvider>
        <NotificationProvider>
          <Toaster />
          <Router />
        </NotificationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;