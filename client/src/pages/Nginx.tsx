import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  Edit, 
  Save,
  TestTube,
  Download
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Nginx() {
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [editingConfig, setEditingConfig] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: configs, isLoading: configsLoading } = useQuery<any[]>({
    queryKey: ["/api/nginx/configs"],
  });

  const testConfigMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/nginx/test", { content });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "تم اختبار التكوين",
          description: "تكوين Nginx صالح",
        });
      } else {
        toast({
          title: "خطأ في التكوين",
          description: data.error,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "خطأ في الاختبار",
        description: "فشل في اختبار تكوين Nginx",
        variant: "destructive",
      });
    },
  });

  const reloadNginxMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/nginx/reload");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nginx/configs"] });
      toast({
        title: "تم إعادة تحميل Nginx",
        description: "تم إعادة تحميل تكوين Nginx بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في إعادة التحميل",
        description: "فشل في إعادة تحميل Nginx",
        variant: "destructive",
      });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async (data: { content: string; configPath: string; applicationId: string }) => {
      await apiRequest("POST", "/api/nginx/configs", {
        ...data,
        enabled: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nginx/configs"] });
      toast({
        title: "تم حفظ التكوين",
        description: "تم حفظ تكوين Nginx بنجاح",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "خطأ في الحفظ",
        description: "فشل في حفظ تكوين Nginx",
        variant: "destructive",
      });
    },
  });

  const handleEditConfig = (config: any) => {
    setSelectedConfig(config);
    setEditingConfig(config.content);
    setIsEditing(true);
  };

  const handleTestConfig = () => {
    testConfigMutation.mutate(editingConfig);
  };

  const handleSaveConfig = () => {
    if (!selectedConfig) return;
    saveConfigMutation.mutate({
      content: editingConfig,
      configPath: selectedConfig.configPath,
      applicationId: selectedConfig.applicationId,
    });
  };

  const getStatusBadge = (config: any) => {
    if (config.enabled && config.testResult === 'passed') {
      return (
        <Badge className="bg-green-500/20 text-green-400">
          <CheckCircle className="w-3 h-3 ml-1" />
          فعّال
        </Badge>
      );
    } else if (config.testResult === 'failed') {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="w-3 h-3 ml-1" />
          خطأ
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <Settings className="w-3 h-3 ml-1" />
          معطل
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6" data-testid="nginx-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">إعدادات Nginx</h2>
          <p className="text-muted-foreground">إدارة ملفات تكوين Nginx</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => testConfigMutation.mutate("")}
            disabled={testConfigMutation.isPending}
            data-testid="button-test-nginx"
          >
            <TestTube className="w-4 h-4 ml-2" />
            اختبار التكوين الحالي
          </Button>
          <Button
            onClick={() => reloadNginxMutation.mutate()}
            disabled={reloadNginxMutation.isPending}
            data-testid="button-reload-nginx"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعادة تحميل Nginx
          </Button>
        </div>
      </div>

      <Tabs defaultValue="configs" className="w-full">
        <TabsList>
          <TabsTrigger value="configs">ملفات التكوين</TabsTrigger>
          <TabsTrigger value="editor">محرر التكوين</TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          {configsLoading ? (
            <div className="grid gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : configs?.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد ملفات تكوين</h3>
                <p className="text-muted-foreground">ابدأ بإنشاء ملف تكوين جديد</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4" data-testid="nginx-configs-list">
              {configs?.map((config: any) => (
                <Card key={config.id} className="hover:shadow-md transition-shadow" data-testid={`config-${config.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold" data-testid={`config-path-${config.id}`}>
                            {config.configPath}
                          </h3>
                          {getStatusBadge(config)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {config.lastTest && (
                            <p>آخر اختبار: {new Date(config.lastTest).toLocaleDateString('ar-SA')}</p>
                          )}
                          {config.testResult && (
                            <p>نتيجة الاختبار: 
                              <span className={`mr-1 ${config.testResult === 'passed' ? 'text-green-500' : 'text-red-500'}`}>
                                {config.testResult === 'passed' ? 'نجح' : 'فشل'}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedConfig(config)}
                          data-testid={`button-view-${config.id}`}
                        >
                          <Eye className="w-4 h-4" />
                          عرض
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditConfig(config)}
                          data-testid={`button-edit-${config.id}`}
                        >
                          <Edit className="w-4 h-4" />
                          تعديل
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {}} // TODO: Download config
                          data-testid={`button-download-${config.id}`}
                        >
                          <Download className="w-4 h-4" />
                          تحميل
                        </Button>
                      </div>
                    </div>

                    {selectedConfig?.id === config.id && !isEditing && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">محتوى التكوين:</h4>
                        <pre className="text-sm bg-background p-4 rounded border overflow-auto max-h-64">
                          {config.content}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {isEditing && selectedConfig ? (
            <Card data-testid="config-editor">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>تعديل تكوين: {selectedConfig.configPath}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestConfig}
                      disabled={testConfigMutation.isPending}
                      data-testid="button-test-config"
                    >
                      <TestTube className="w-4 h-4 ml-2" />
                      اختبار
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveConfig}
                      disabled={saveConfigMutation.isPending}
                      data-testid="button-save-config"
                    >
                      <Save className="w-4 h-4 ml-2" />
                      حفظ
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editingConfig}
                  onChange={(e) => setEditingConfig(e.target.value)}
                  className="font-mono text-sm min-h-[400px]"
                  placeholder="أدخل تكوين Nginx..."
                  data-testid="textarea-config-content"
                />
                
                {testConfigMutation.data && (
                  <div className={`mt-4 p-4 rounded-lg ${
                    testConfigMutation.data.success ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'
                  }`}>
                    <h4 className="font-medium mb-2">نتيجة الاختبار:</h4>
                    <pre className="text-sm whitespace-pre-wrap">
                      {testConfigMutation.data.success ? 'التكوين صالح ✓' : testConfigMutation.data.error}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Edit className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">محرر التكوين</h3>
                <p className="text-muted-foreground">اختر ملف تكوين للتعديل أو أنشئ واحداً جديداً</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
