import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// أنواع مؤقتة للمراقبة
interface SystemMetrics {
  id?: string;
  cpuUsage?: number;
  memoryUsage?: number;
  timestamp?: string;
}

interface ErrorLog {
  id?: string;
  message?: string;
  level?: string;
  timestamp?: string;
}

interface DiagnosticCheck {
  id?: string;
  name?: string;
  status?: string;
  timestamp?: string;
}

export function useMonitoring() {
  const queryClient = useQueryClient();

  // System metrics
  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery<SystemMetrics>({
    queryKey: ['/api/metrics/current'],
    refetchInterval: 120000, // Auto-refresh every 2 minutes لتقليل الحمولة
  });

  // Error logs
  const {
    data: errorLogs = [],
    isLoading: logsLoading,
  } = useQuery<ErrorLog[]>({
    queryKey: ['/api/error-logs'],
    refetchInterval: 120000, // Auto-refresh every 2 minutes لتقليل الحمولة
  });

  // Diagnostic checks
  const {
    data: diagnosticChecks = [],
    isLoading: diagnosticsLoading,
  } = useQuery<DiagnosticCheck[]>({
    queryKey: ['/api/diagnostics/checks'],
  });

  // Mutations
  const updateMetricsMutation = useMutation({
    mutationFn: () => fetch('/api/metrics/update', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/metrics/current'] });
    },
  });

  const runDiagnosticsMutation = useMutation({
    mutationFn: () => fetch('/api/diagnostics/run', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/diagnostics/checks'] });
    },
  });

  return {
    // Data
    metrics,
    errorLogs,
    diagnosticChecks,
    
    // Loading states
    metricsLoading,
    logsLoading,
    diagnosticsLoading,
    
    // Actions
    refetchMetrics,
    updateMetrics: updateMetricsMutation.mutate,
    runDiagnostics: runDiagnosticsMutation.mutate,
    
    // Mutation states
    isUpdatingMetrics: updateMetricsMutation.isPending,
    isRunningDiagnostics: runDiagnosticsMutation.isPending,
  };
}
