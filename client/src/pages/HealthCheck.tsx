import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Database, 
  Server, 
  Settings, 
  Download, 
  RefreshCw,
  Info,
  Activity,
  Shield,
  Zap,
  Package,
  Globe,
  Lock,
  Edit,
  BarChart3,
  Flame,
  HelpCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface HealthCheckResult {
  database: {
    status: string;
    message: string;
    details?: any;
  };
  system: {
    status: string;
    message: string;
    details?: any;
  };
  services: {
    status: string;
    message: string;
    details?: any;
  };
  overall: {
    status: string;
    score: number;
    message: string;
  };
}

interface Dependency {
  name: string;
  displayName: string;
  description: string;
  category: 'critical' | 'recommended' | 'optional';
  installed: boolean;
  version?: string;
  installCommand?: string;
  checkCommand: string;
  icon: string;
  purpose: string;
  installable: boolean;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'error':
    case 'critical':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-500" />;
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'healthy':
      return 'default';
    case 'warning':
      return 'secondary';
    case 'error':
    case 'critical':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'recommended':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'optional':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'critical':
      return <Flame className="h-4 w-4" />;
    case 'recommended':
      return <Settings className="h-4 w-4" />;
    case 'optional':
      return <Package className="h-4 w-4" />;
    default:
      return <Package className="h-4 w-4" />;
  }
};

export default function HealthCheck() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Health check query
  const { 
    data: healthData, 
    isLoading: healthLoading, 
    refetch: refetchHealth,
    error: healthError
  } = useQuery<HealthCheckResult>({
    queryKey: ["/api/system/health-check"],
    refetchInterval: 30000, // تحديث كل 30 ثانية
  });

  // Dependencies query
  const { 
    data: dependencies, 
    isLoading: depsLoading, 
    refetch: refetchDeps 
  } = useQuery<Dependency[]>({
    queryKey: ["/api/system/dependencies"],
    refetchInterval: 60000, // تحديث كل دقيقة
  });

  // Install dependency mutation
  const installMutation = useMutation({
    mutationFn: async (dependencyName: string) => {
      return await apiRequest('/api/system/install-dependency', 'POST', { dependencyName });
    },
    onSuccess: (data, dependencyName) => {
      if (data.success) {
        toast({
          title: "نجح التثبيت!",
          description: data.message,
        });
        // إعادة جلب البيانات
        refetchDeps();
        refetchHealth();
      } else {
        toast({
          title: "فشل التثبيت",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التثبيت",
        description: error.message || "حدث خطأ أثناء التثبيت",
        variant: "destructive",
      });
    },
  });

  const handleInstall = (dependencyName: string, displayName: string) => {
    toast({
      title: "جاري التثبيت...",
      description: `جاري تثبيت ${displayName}، يرجى الانتظار...`,
    });
    installMutation.mutate(dependencyName);
  };

  const handleRefresh = () => {
    refetchHealth();
    refetchDeps();
    toast({
      title: "تحديث البيانات",
      description: "جاري تحديث بيانات الفحص...",
    });
  };

  // تصفية التبعيات حسب الفئة
  const filteredDependencies = dependencies?.filter(dep => 
    selectedCategory === 'all' || dep.category === selectedCategory
  ) || [];

  const criticalCount = dependencies?.filter(dep => dep.category === 'critical' && !dep.installed).length || 0;
  const installedCount = dependencies?.filter(dep => dep.installed).length || 0;
  const totalCount = dependencies?.length || 0;

  return (
    <TooltipProvider>
      <div className="space-y-6" data-testid="health-check-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">فحص النظام الشامل</h1>
            <p className="text-muted-foreground mt-2">
              اختبر وتأكد من سلامة جميع مكونات النظام والأدوات المطلوبة
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={healthLoading || depsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(healthLoading || depsLoading) ? 'animate-spin' : ''}`} />
            تحديث الفحص
          </Button>
        </div>

        {/* نظرة عامة سريعة */}
        {healthData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* النتيجة الإجمالية */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  {getStatusIcon(healthData.overall.status)}
                  الحالة العامة للنظام
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{healthData.overall.score}%</span>
                    <Badge variant={getStatusBadgeVariant(healthData.overall.status)}>
                      {healthData.overall.status === 'healthy' ? 'ممتاز' :
                       healthData.overall.status === 'warning' ? 'تحذير' : 'يحتاج إصلاح'}
                    </Badge>
                  </div>
                  <Progress value={healthData.overall.score} className="w-full" />
                  <p className="text-sm text-muted-foreground">
                    {healthData.overall.message}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* إحصائيات الأدوات */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  الأدوات المثبتة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <span className="text-2xl font-bold text-green-600">{installedCount}</span>
                  <span className="text-muted-foreground"> / {totalCount}</span>
                  <p className="text-sm text-muted-foreground mt-1">أدوات متوفرة</p>
                </div>
              </CardContent>
            </Card>

            {/* تنبيهات مهمة */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  أدوات مفقودة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <span className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {criticalCount}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">أدوات أساسية</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* تبويبات المحتوى */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="health">فحص صحة النظام</TabsTrigger>
            <TabsTrigger value="dependencies">الأدوات والتبعيات</TabsTrigger>
            <TabsTrigger value="guide">دليل المبتدئين</TabsTrigger>
          </TabsList>

          {/* نظرة عامة */}
          <TabsContent value="overview" className="space-y-4">
            {healthError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>خطأ في الفحص</AlertTitle>
                <AlertDescription>
                  فشل في تحميل بيانات الفحص. يرجى المحاولة مرة أخرى.
                </AlertDescription>
              </Alert>
            )}
            
            {healthData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* فحص قاعدة البيانات */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      قاعدة البيانات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(healthData.database.status)}
                      <Badge variant={getStatusBadgeVariant(healthData.database.status)}>
                        {healthData.database.status === 'healthy' ? 'متصلة' : 
                         healthData.database.status === 'warning' ? 'تحذير' : 'غير متصلة'}
                      </Badge>
                    </div>
                    <p className="text-sm">{healthData.database.message}</p>
                  </CardContent>
                </Card>

                {/* فحص موارد النظام */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      موارد النظام
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(healthData.system.status)}
                      <Badge variant={getStatusBadgeVariant(healthData.system.status)}>
                        {healthData.system.status === 'healthy' ? 'طبيعي' : 
                         healthData.system.status === 'warning' ? 'مرتفع' : 'حرج'}
                      </Badge>
                    </div>
                    <p className="text-sm">{healthData.system.message}</p>
                  </CardContent>
                </Card>

                {/* فحص الخدمات */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      الخدمات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(healthData.services.status)}
                      <Badge variant={getStatusBadgeVariant(healthData.services.status)}>
                        {healthData.services.status === 'healthy' ? 'متوفرة' : 
                         healthData.services.status === 'warning' ? 'ناقصة' : 'غير متوفرة'}
                      </Badge>
                    </div>
                    <p className="text-sm">{healthData.services.message}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* فحص صحة النظام التفصيلي */}
          <TabsContent value="health" className="space-y-4">
            {healthLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>جاري فحص النظام...</p>
              </div>
            ) : healthData ? (
              <div className="space-y-4">
                {/* قاعدة البيانات */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      فحص قاعدة البيانات التفصيلي
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(healthData.database.status)}
                      <div className="flex-1">
                        <p className="font-medium">{healthData.database.message}</p>
                        {healthData.database.details && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <pre className="bg-muted p-2 rounded text-xs">
                              {JSON.stringify(healthData.database.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* موارد النظام */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      موارد النظام التفصيلية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(healthData.system.status)}
                      <div className="flex-1">
                        <p className="font-medium">{healthData.system.message}</p>
                        {healthData.system.details && (
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-3 bg-muted rounded">
                              <p className="text-2xl font-bold">{healthData.system.details.cpu?.usage || 0}%</p>
                              <p className="text-sm text-muted-foreground">استخدام المعالج</p>
                            </div>
                            <div className="text-center p-3 bg-muted rounded">
                              <p className="text-2xl font-bold">{healthData.system.details.memory?.usage || 0}%</p>
                              <p className="text-sm text-muted-foreground">استخدام الذاكرة</p>
                            </div>
                            <div className="text-center p-3 bg-muted rounded">
                              <p className="text-2xl font-bold">{healthData.system.details.disk?.usage || 0}%</p>
                              <p className="text-sm text-muted-foreground">استخدام القرص</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* الخدمات */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      فحص الخدمات التفصيلي
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(healthData.services.status)}
                      <div className="flex-1">
                        <p className="font-medium">{healthData.services.message}</p>
                        {healthData.services.details && (
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-green-50 rounded">
                              <p className="text-2xl font-bold text-green-600">{healthData.services.details.installed || 0}</p>
                              <p className="text-sm text-muted-foreground">أدوات مثبتة</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded">
                              <p className="text-2xl font-bold text-red-600">{healthData.services.details.missing || 0}</p>
                              <p className="text-sm text-muted-foreground">أدوات مفقودة</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>لا توجد بيانات</AlertTitle>
                <AlertDescription>
                  لا يمكن عرض بيانات فحص النظام حالياً.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* الأدوات والتبعيات */}
          <TabsContent value="dependencies" className="space-y-4">
            {/* فلاتر الفئات */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-medium">تصفية حسب الفئة:</span>
              <div className="flex gap-2">
                {['all', 'critical', 'recommended', 'optional'].map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category === 'all' ? 'الكل' :
                     category === 'critical' ? 'أساسية' :
                     category === 'recommended' ? 'موصى بها' : 'اختيارية'}
                  </Button>
                ))}
              </div>
            </div>

            {depsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>جاري فحص الأدوات...</p>
              </div>
            ) : filteredDependencies.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDependencies.map((dep) => (
                  <Card key={dep.name} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span className="text-lg">{dep.icon}</span>
                          {dep.displayName}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getCategoryColor(dep.category)}`}
                          >
                            {getCategoryIcon(dep.category)}
                            <span className="mr-1">
                              {dep.category === 'critical' ? 'أساسي' :
                               dep.category === 'recommended' ? 'موصى به' : 'اختياري'}
                            </span>
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{dep.description}</p>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <p className="text-sm font-medium">الغرض من هذه الأداة:</p>
                        <p className="text-sm text-muted-foreground">{dep.purpose}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {dep.installed ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-600 font-medium">مثبت</span>
                            {dep.version && (
                              <Badge variant="outline" className="text-xs">{dep.version}</Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-600 font-medium">غير مثبت</span>
                          </>
                        )}
                      </div>

                      {!dep.installed && dep.installable && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleInstall(dep.name, dep.displayName)}
                            disabled={installMutation.isPending}
                            data-testid={`button-install-${dep.name}`}
                          >
                            {installMutation.isPending ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                جاري التثبيت...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                تثبيت الآن
                              </>
                            )}
                          </Button>
                        </div>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full">
                            <Info className="h-4 w-4 mr-2" />
                            معلومات تقنية
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm">
                          <div className="space-y-1">
                            <p><strong>أمر الفحص:</strong> {dep.checkCommand}</p>
                            {dep.installCommand && (
                              <p><strong>أمر التثبيت:</strong> {dep.installCommand}</p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Alert>
                <Package className="h-4 w-4" />
                <AlertTitle>لا توجد أدوات</AlertTitle>
                <AlertDescription>
                  لا توجد أدوات في هذه الفئة أو حدث خطأ في تحميل البيانات.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* دليل المبتدئين */}
          <TabsContent value="guide" className="space-y-4">
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>مرحباً بك في دليل المبتدئين! 👋</AlertTitle>
              <AlertDescription>
                هذا الدليل سيساعدك على فهم كيفية استخدام لوحة التحكم بسهولة.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-500" />
                    ما هو فحص النظام؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    فحص النظام يتأكد من أن جميع أجزاء الخادم تعمل بشكل صحيح:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 mr-4">
                    <li>• قاعدة البيانات متصلة ومتاحة</li>
                    <li>• موارد النظام (معالج، ذاكرة، قرص) طبيعية</li>
                    <li>• الأدوات المطلوبة مثبتة</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-green-500" />
                    ما هي الأدوات المطلوبة؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    الأدوات مقسمة لثلاث فئات:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 mr-4">
                    <li>• <span className="text-red-600 font-semibold">أساسية:</span> لازمة لعمل النظام</li>
                    <li>• <span className="text-blue-600 font-semibold">موصى بها:</span> تحسن الأداء والأمان</li>
                    <li>• <span className="text-gray-600 font-semibold">اختيارية:</span> أدوات إضافية مفيدة</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-purple-500" />
                    كيف أثبت الأدوات؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    التثبيت أصبح سهلاً جداً:
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-1 mr-4">
                    <li>1. اذهب لتبويب "الأدوات والتبعيات"</li>
                    <li>2. ابحث عن الأداة غير المثبتة</li>
                    <li>3. اضغط "تثبيت الآن"</li>
                    <li>4. انتظر حتى اكتمال التثبيت</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-orange-500" />
                    كيف أفهم النتائج؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    الألوان تشرح حالة النظام:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">أخضر = كل شيء يعمل بشكل ممتاز</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">أصفر = يوجد تحذير بسيط</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">أحمر = يحتاج إصلاح فوري</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-indigo-500" />
                  أسئلة شائعة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-sm">س: ماذا لو كان النظام يظهر "تحذير"؟</p>
                  <p className="text-sm text-muted-foreground">ج: التحذيرات عادية وتعني أن النظام يعمل لكن يمكن تحسينه. لا تقلق!</p>
                </div>
                <Separator />
                <div>
                  <p className="font-medium text-sm">س: هل التثبيت التلقائي آمن؟</p>
                  <p className="text-sm text-muted-foreground">ج: نعم، جميع الأوامر مختبرة وآمنة. نحن نستخدم الطرق الرسمية للتثبيت.</p>
                </div>
                <Separator />
                <div>
                  <p className="font-medium text-sm">س: كم يستغرق التثبيت؟</p>
                  <p className="text-sm text-muted-foreground">ج: عادة بين 30 ثانية إلى دقيقتين حسب حجم الأداة وسرعة الإنترنت.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}