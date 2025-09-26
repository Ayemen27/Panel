
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Play, 
  Download, 
  RefreshCw,
  Shield,
  Zap,
  Settings,
  Eye,
  FileText,
  Database,
  Globe
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AuditIssue {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  category: 'Security' | 'Performance' | 'Functionality' | 'UI/UX' | 'Deployment';
  description: string;
  reproductionSteps: string[];
  affectedFiles: string[];
  suggestedFix: string;
  status: 'Open' | 'Fixed' | 'Acceptable' | 'Monitor';
  evidence?: {
    screenshots?: string[];
    logs?: string[];
    outputs?: string[];
  };
}

interface AuditReport {
  timestamp: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  readyForDeployment: boolean;
  issues: AuditIssue[];
  checklist: Record<string, 'PASS' | 'FAIL'>;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'Critical':
      return 'bg-red-500 text-white';
    case 'High':
      return 'bg-red-400 text-white';
    case 'Medium':
      return 'bg-yellow-500 text-white';
    case 'Low':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Security':
      return <Shield className="h-4 w-4" />;
    case 'Performance':
      return <Zap className="h-4 w-4" />;
    case 'Functionality':
      return <Settings className="h-4 w-4" />;
    case 'UI/UX':
      return <Eye className="h-4 w-4" />;
    case 'Deployment':
      return <Globe className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export default function ComprehensiveAudit() {
  const { toast } = useToast();
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Run audit mutation
  const auditMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/system/audit/comprehensive');
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setAuditReport(data.data);
        toast({
          title: "نجح الفحص الشامل! ✅",
          description: `تم العثور على ${data.data.summary.total} مشكلة`,
        });
      } else {
        toast({
          title: "فشل الفحص",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الفحص",
        description: error.message || "حدث خطأ أثناء تشغيل الفحص الشامل",
        variant: "destructive",
      });
    },
  });

  const handleRunAudit = () => {
    toast({
      title: "بدء الفحص الشامل",
      description: "جاري فحص جميع جوانب التطبيق، قد يستغرق هذا عدة دقائق...",
    });
    auditMutation.mutate();
  };

  const downloadReport = () => {
    if (!auditReport) return;
    
    const reportData = {
      ...auditReport,
      generatedAt: new Date().toISOString(),
      generatedBy: 'System Audit Tool'
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "تم تنزيل التقرير",
      description: "تم حفظ تقرير الفحص الشامل",
    });
  };

  // Filter issues by category
  const filteredIssues = auditReport?.issues.filter(issue => 
    selectedCategory === 'all' || issue.category === selectedCategory
  ) || [];

  return (
    <div className="space-y-6" data-testid="comprehensive-audit-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الفحص الشامل للتطبيق</h1>
          <p className="text-muted-foreground mt-2">
            فحص عميق لجميع جوانب التطبيق: الأمان، الأداء، الوظائف، والجاهزية للنشر
          </p>
        </div>
        <div className="flex gap-2">
          {auditReport && (
            <Button variant="outline" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-2" />
              تنزيل التقرير
            </Button>
          )}
          <Button onClick={handleRunAudit} disabled={auditMutation.isPending}>
            {auditMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {auditMutation.isPending ? 'جاري الفحص...' : 'بدء الفحص الشامل'}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {auditMutation.isPending && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <RefreshCw className="h-12 w-12 animate-spin mx-auto text-blue-500" />
              <h3 className="text-lg font-medium">جاري تشغيل الفحص الشامل...</h3>
              <p className="text-muted-foreground">
                يتم فحص جميع جوانب التطبيق، يرجى الانتظار. قد يستغرق هذا عدة دقائق.
              </p>
              <div className="max-w-md mx-auto">
                <Progress value={undefined} className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {auditReport && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  {auditReport.readyForDeployment ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  حالة النشر
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge 
                    variant={auditReport.readyForDeployment ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {auditReport.readyForDeployment ? '✅ جاهز للنشر' : '❌ غير جاهز للنشر'}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {auditReport.readyForDeployment 
                      ? 'التطبيق اجتاز جميع فحوصات النشر الأساسية'
                      : 'يوجد مشاكل تحتاج إصلاح قبل النشر'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  مشاكل حرجة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <span className="text-2xl font-bold text-red-600">
                    {auditReport.summary.critical}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">تحتاج إصلاح فوري</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  مشاكل مهمة
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <span className="text-2xl font-bold text-yellow-600">
                    {auditReport.summary.high}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">يُفضل إصلاحها</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  إجمالي المشاكل
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <span className="text-2xl font-bold text-blue-600">
                    {auditReport.summary.total}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">مشكلة تم العثور عليها</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="issues" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="issues">المشاكل المكتشفة</TabsTrigger>
              <TabsTrigger value="checklist">قائمة فحص النشر</TabsTrigger>
              <TabsTrigger value="recommendations">التوصيات</TabsTrigger>
            </TabsList>

            {/* Issues Tab */}
            <TabsContent value="issues" className="space-y-4">
              {/* Category Filter */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">تصفية حسب الفئة:</span>
                <div className="flex gap-2">
                  {['all', 'Security', 'Performance', 'Functionality', 'UI/UX', 'Deployment'].map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {getCategoryIcon(category)}
                      <span className="mr-1">
                        {category === 'all' ? 'الكل' :
                         category === 'Security' ? 'أمان' :
                         category === 'Performance' ? 'أداء' :
                         category === 'Functionality' ? 'وظائف' :
                         category === 'UI/UX' ? 'تجربة مستخدم' : 'نشر'}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {filteredIssues.length > 0 ? (
                <div className="space-y-4">
                  {filteredIssues.map((issue) => (
                    <Card key={issue.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getSeverityColor(issue.severity)}>
                                {issue.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {getCategoryIcon(issue.category)}
                                <span className="mr-1">{issue.category}</span>
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{issue.title}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {issue.description}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Reproduction Steps */}
                        {issue.reproductionSteps.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">خطوات إعادة الإنتاج:</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                              {issue.reproductionSteps.map((step, index) => (
                                <li key={index}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Affected Files */}
                        {issue.affectedFiles.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">الملفات المتأثرة:</h4>
                            <div className="flex flex-wrap gap-1">
                              {issue.affectedFiles.map((file, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {file}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <Separator />

                        {/* Suggested Fix */}
                        <div>
                          <h4 className="font-medium mb-2">الحل المقترح:</h4>
                          <p className="text-sm bg-muted p-3 rounded">
                            {issue.suggestedFix}
                          </p>
                        </div>

                        {/* Evidence */}
                        {issue.evidence && (
                          <div>
                            <h4 className="font-medium mb-2">الأدلة:</h4>
                            {issue.evidence.outputs && (
                              <div className="space-y-2">
                                {issue.evidence.outputs.map((output, index) => (
                                  <pre key={index} className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                    {output}
                                  </pre>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>لا توجد مشاكل في هذه الفئة</AlertTitle>
                  <AlertDescription>
                    لم يتم العثور على مشاكل في الفئة المحددة.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>قائمة فحص جاهزية النشر</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(auditReport.checklist).map(([item, status]) => (
                      <div key={item} className="flex items-center justify-between p-3 rounded border">
                        <span className="font-medium">{item}</span>
                        <Badge variant={status === 'PASS' ? 'default' : 'destructive'}>
                          {status === 'PASS' ? (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          {status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-500" />
                      توصيات الأمان
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• تحديث التبعيات بانتظام</li>
                      <li>• استخدام HTTPS في الإنتاج</li>
                      <li>• مراجعة صلاحيات المستخدمين</li>
                      <li>• تفعيل CSRF protection</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      توصيات الأداء
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• تحسين أحجام الصور</li>
                      <li>• استخدام lazy loading</li>
                      <li>• تفعيل caching للـ APIs</li>
                      <li>• ضغط الـ bundle</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-green-500" />
                      توصيات تجربة المستخدم
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• تحسين الوصولية (a11y)</li>
                      <li>• دعم أفضل للـ RTL</li>
                      <li>• تحسين التصميم المتجاوب</li>
                      <li>• رسائل خطأ أوضح</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-purple-500" />
                      توصيات النشر
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• إعداد النسخ الاحتياطية</li>
                      <li>• مراقبة النظام</li>
                      <li>• إعداد alerts</li>
                      <li>• وثائق النشر</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* No Results State */}
      {!auditMutation.isPending && !auditReport && (
        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <Database className="h-16 w-16 mx-auto text-muted-foreground" />
              <h3 className="text-xl font-medium">جاهز لبدء الفحص الشامل</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                اضغط على "بدء الفحص الشامل" لتشغيل فحص عميق لجميع جوانب التطبيق. 
                سيتم فحص الأمان، الأداء، الوظائف، والجاهزية للنشر.
              </p>
              <Button onClick={handleRunAudit} size="lg">
                <Play className="h-5 w-5 mr-2" />
                بدء الفحص الشامل
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
