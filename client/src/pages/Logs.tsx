import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle,
  Play,
  Square
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source: string;
  applicationId?: string;
}

export default function Logs() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedApp, setSelectedApp] = useState("");
  const [isLiveTail, setIsLiveTail] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "غير مخول",
        description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Handle real-time log updates via WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'LOG_ENTRY' && isLiveTail) {
      const logEntry = lastMessage.data as LogEntry;
      setLiveLogs(prev => [logEntry, ...prev.slice(0, 99)]); // Keep last 100 entries
    }
  }, [lastMessage, isLiveTail]);

  const { data: applications } = useQuery({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
  });

  const { data: logs, isLoading: logsLoading, error, refetch } = useQuery({
    queryKey: ["/api/logs", { 
      source: sourceFilter !== "all" ? sourceFilter : undefined,
      level: levelFilter !== "all" ? levelFilter : undefined,
      applicationId: selectedApp || undefined,
      limit: 100
    }],
    enabled: isAuthenticated,
    refetchInterval: isLiveTail ? 5000 : false,
  });

  const { data: nginxLogs, isLoading: nginxLoading } = useQuery({
    queryKey: ["/api/logs/nginx"],
    enabled: isAuthenticated && activeTab === "nginx",
  });

  const { data: systemLogs, isLoading: systemLoading } = useQuery({
    queryKey: ["/api/logs/system"],
    enabled: isAuthenticated && activeTab === "system",
  });

  if (error && isUnauthorizedError(error as Error)) {
    return null;
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'debug':
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <Badge variant="destructive">خطأ</Badge>;
      case 'warn':
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400">تحذير</Badge>;
      case 'info':
        return <Badge className="bg-blue-500/20 text-blue-400">معلومات</Badge>;
      case 'debug':
        return <Badge variant="outline">تصحيح</Badge>;
      default:
        return <Badge variant="secondary">{level}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    const colors = {
      nginx: "bg-green-500/20 text-green-400",
      pm2: "bg-purple-500/20 text-purple-400",
      system: "bg-orange-500/20 text-orange-400",
      app: "bg-blue-500/20 text-blue-400",
    };
    
    return (
      <Badge className={colors[source as keyof typeof colors] || "bg-gray-500/20 text-gray-400"}>
        {source}
      </Badge>
    );
  };

  const filteredLogs = (isLiveTail ? liveLogs : logs || []).filter((log: LogEntry) => {
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const renderLogsList = (logsList: LogEntry[], loading: boolean) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4 border border-border rounded-lg">
              <Skeleton className="w-4 h-4 rounded mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (logsList.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد سجلات</h3>
          <p className="text-muted-foreground">لا توجد سجلات متاحة للعرض</p>
        </div>
      );
    }

    return (
      <div className="space-y-3" data-testid="logs-list">
        {logsList.map((log, index) => (
          <div 
            key={`${log.timestamp}-${index}`}
            className="flex items-start gap-3 p-4 border border-border rounded-lg hover:bg-accent transition-colors"
            data-testid={`log-entry-${index}`}
          >
            {getLevelIcon(log.level)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {getLevelBadge(log.level)}
                {getSourceBadge(log.source)}
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true, locale: ar })}
                </span>
              </div>
              <p className="text-sm leading-relaxed break-words" data-testid={`log-message-${index}`}>
                {log.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(log.timestamp).toLocaleString('ar-SA')}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="logs-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">السجلات</h2>
          <p className="text-muted-foreground">عرض وبحث سجلات النظام والتطبيقات</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isLiveTail ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLiveTail(!isLiveTail)}
            data-testid="button-live-tail"
          >
            {isLiveTail ? <Square className="w-4 h-4 ml-2" /> : <Play className="w-4 h-4 ml-2" />}
            {isLiveTail ? "إيقاف المتابعة المباشرة" : "متابعة مباشرة"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={logsLoading}
            data-testid="button-refresh-logs"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card data-testid="logs-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            البحث والفلترة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">البحث في السجلات</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الرسائل..."
                  className="pr-10"
                  data-testid="input-search-logs"
                />
              </div>
            </div>
            
            <div>
              <Label>مستوى السجل</Label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger data-testid="select-level-filter">
                  <SelectValue placeholder="اختر المستوى" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المستويات</SelectItem>
                  <SelectItem value="error">خطأ</SelectItem>
                  <SelectItem value="warn">تحذير</SelectItem>
                  <SelectItem value="info">معلومات</SelectItem>
                  <SelectItem value="debug">تصحيح</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>المصدر</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger data-testid="select-source-filter">
                  <SelectValue placeholder="اختر المصدر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المصادر</SelectItem>
                  <SelectItem value="nginx">Nginx</SelectItem>
                  <SelectItem value="pm2">PM2</SelectItem>
                  <SelectItem value="system">النظام</SelectItem>
                  <SelectItem value="app">التطبيقات</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>التطبيق</Label>
              <Select value={selectedApp} onValueChange={setSelectedApp}>
                <SelectTrigger data-testid="select-app-filter">
                  <SelectValue placeholder="اختر التطبيق" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">جميع التطبيقات</SelectItem>
                  {applications?.map((app: any) => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">جميع السجلات</TabsTrigger>
          <TabsTrigger value="nginx">Nginx</TabsTrigger>
          <TabsTrigger value="system">النظام</TabsTrigger>
          <TabsTrigger value="apps">التطبيقات</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  جميع السجلات
                  {isLiveTail && (
                    <Badge className="bg-green-500/20 text-green-400 animate-pulse">
                      مباشر
                    </Badge>
                  )}
                </CardTitle>
                <Button variant="outline" size="sm" data-testid="button-download-logs">
                  <Download className="w-4 h-4 ml-2" />
                  تحميل
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {renderLogsList(filteredLogs, logsLoading)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nginx" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                سجلات Nginx
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderLogsList(nginxLogs || [], nginxLoading)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                سجلات النظام
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderLogsList(systemLogs || [], systemLoading)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apps" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                سجلات التطبيقات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedApp ? (
                renderLogsList(
                  filteredLogs.filter((log: LogEntry) => log.applicationId === selectedApp),
                  logsLoading
                )
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">اختر تطبيقاً</h3>
                  <p className="text-muted-foreground">اختر تطبيقاً من الفلتر أعلاه لعرض سجلاته</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
