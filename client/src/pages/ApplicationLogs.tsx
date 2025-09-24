
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ApplicationLogs() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: [`/api/applications/${id}/logs`],
    enabled: !!id,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: application } = useQuery({
    queryKey: [`/api/applications/${id}`],
    enabled: !!id,
  });

  const handleDownloadLogs = () => {
    if (logs && logs.length > 0) {
      const logsText = logs.join('\n');
      const blob = new Blob([logsText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${application?.name || 'app'}-logs.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة
          </Button>
          <div>
            <h2 className="text-2xl font-bold">سجلات التطبيق</h2>
            <p className="text-muted-foreground">
              {application?.name || 'التطبيق'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadLogs}
            disabled={!logs || logs.length === 0}
          >
            <Download className="w-4 h-4 ml-2" />
            تنزيل
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجلات التطبيق المباشرة</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              <span className="mr-2">جاري تحميل السجلات...</span>
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد سجلات متاحة
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
