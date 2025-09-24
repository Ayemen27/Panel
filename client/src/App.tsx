import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Applications from "@/pages/Applications";
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
        <Route path="/" nest>
          <MainLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/applications" component={Applications} />
              <Route path="/domains" component={Domains} />
              <Route path="/nginx" component={Nginx} />
              <Route path="/ssl" component={SSL} />
              <Route path="/processes" component={Processes} />
              <Route path="/logs" component={Logs} />
              <Route path="/terminal" component={Terminal} />
              <Route path="/health-check" component={HealthCheck} />
              <Route component={NotFound} />
            </Switch>
          </MainLayout>
        </Route>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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
