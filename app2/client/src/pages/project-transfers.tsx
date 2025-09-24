import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectFundTransferSchema } from "@shared/schema";
import type { InsertProjectFundTransfer, ProjectFundTransfer, Project } from "@shared/schema";
import { Plus, ArrowRight, Calendar, User, FileText, Edit, Banknote, Building, Trash2, ChartGantt, DollarSign, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard, StatsGrid } from "@/components/ui/stats-card";
import ProjectSelector from "@/components/project-selector";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { z } from "zod";
import { useFloatingButton } from "@/components/layout/floating-button-context";

type TransferFormData = z.infer<typeof insertProjectFundTransferSchema>;

export default function ProjectTransfers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<ProjectFundTransfer | null>(null);
  const { setFloatingAction } = useFloatingButton();
  const { selectedProjectId, selectProject } = useSelectedProject();

  // تعيين المشروع الافتراضي لعرض جميع التحويلات
  const currentProjectId = selectedProjectId || 'all';

  // تعيين إجراء الزر العائم لإضافة تحويل جديد
  useEffect(() => {
    const handleAddTransfer = () => {
      setShowForm(true);
      setEditingTransfer(null);
    };
    
    setFloatingAction(handleAddTransfer, "إضافة عملية ترحيل");
    return () => setFloatingAction(null);
  }, [setFloatingAction]);

  // دالة مساعدة لحفظ القيم في autocomplete_data
  const saveAutocompleteValue = async (category: string, value: string | null | undefined) => {
    if (!value || typeof value !== 'string' || !value.trim()) return;
    try {
      await apiRequest("/api/autocomplete", "POST", { 
        category, 
        value: value.trim() 
      });
    } catch (error) {
      // تجاهل الأخطاء لأن هذه عملية مساعدة
      console.log(`Failed to save autocomplete value for ${category}:`, error);
    }
  };

  // جلب قائمة المشاريع
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // جلب جميع عمليات الترحيل (بدون فلترة)
  const { data: allTransfers = [], isLoading: transfersLoading } = useQuery<ProjectFundTransfer[]>({
    queryKey: ["/api/project-fund-transfers"],
    queryFn: async () => {
      const response = await apiRequest('/api/project-fund-transfers', 'GET');
      return response.data || [];
    },
  });

  // إنشاء أو تحديث عملية ترحيل
  const createTransferMutation = useMutation({
    mutationFn: async (data: InsertProjectFundTransfer) => {
      // حفظ القيم في autocomplete_data قبل العملية الأساسية
      await Promise.all([
        saveAutocompleteValue('transferReasons', data.transferReason),
        saveAutocompleteValue('projectTransferDescriptions', data.description)
      ]);
      
      if (editingTransfer) {
        return apiRequest(`/api/project-fund-transfers/${editingTransfer.id}`, "PATCH", data);
      }
      return apiRequest("/api/project-fund-transfers", "POST", data);
    },
    onSuccess: async (newTransfer, variables) => {
      // تحديث كاش autocomplete للتأكد من ظهور البيانات الجديدة
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });
      
      // تحديث فوري للقائمة بدلاً من إعادة التحميل
      queryClient.setQueryData(["/api/project-fund-transfers"], (oldData: any[]) => {
        if (!oldData) return [newTransfer];
        
        if (editingTransfer) {
          // تحديث العنصر الموجود
          return oldData.map(transfer => 
            transfer.id === editingTransfer.id ? newTransfer : transfer
          );
        } else {
          // إضافة عنصر جديد
          return [newTransfer, ...oldData];
        }
      });
      
      // تحديث إحصائيات المشاريع في الخلفية
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-stats"] });
      
      toast({
        title: "تم بنجاح",
        description: editingTransfer ? "تم تحديث عملية ترحيل الأموال بنجاح" : "تم إنشاء عملية ترحيل الأموال بنجاح",
      });
      setShowForm(false);
      setEditingTransfer(null);
      form.reset();
    },
    onError: async (error: any, variables) => {
      // حفظ القيم في autocomplete_data حتى في حالة الخطأ
      await Promise.all([
        saveAutocompleteValue('transferReasons', variables.transferReason),
        saveAutocompleteValue('projectTransferDescriptions', variables.description)
      ]);
      
      // تحديث كاش autocomplete
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });
      
      toast({
        title: "خطأ",
        description: error.message || "فشل في حفظ عملية الترحيل",
        variant: "destructive",
      });
    },
  });

  // حذف عملية ترحيل
  const deleteTransferMutation = useMutation({
    mutationFn: (transferId: string) =>
      apiRequest(`/api/project-fund-transfers/${transferId}`, "DELETE"),
    onSuccess: (_, transferId) => {
      // حذف فوري من القائمة
      queryClient.setQueryData(["/api/project-fund-transfers"], (oldData: any[]) => {
        if (!oldData) return [];
        return oldData.filter(transfer => transfer.id !== transferId);
      });
      
      // تحديث إحصائيات المشاريع في الخلفية
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-stats"] });
      
      toast({
        title: "تم الحذف",
        description: "تم حذف عملية ترحيل الأموال بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حذف عملية الترحيل",
        variant: "destructive",
      });
    },
  });

  // إعداد النموذج
  const form = useForm<TransferFormData>({
    resolver: zodResolver(insertProjectFundTransferSchema),
    defaultValues: {
      fromProjectId: "",
      toProjectId: "",
      amount: "",
      transferReason: "",
      transferDate: new Date().toISOString().split('T')[0],
      description: "",
    },
  });

  const onSubmit = (data: TransferFormData) => {
    createTransferMutation.mutate(data);
  };

  // بدء تعديل عملية ترحيل
  const startEdit = (transfer: ProjectFundTransfer) => {
    setEditingTransfer(transfer);
    form.reset({
      fromProjectId: transfer.fromProjectId,
      toProjectId: transfer.toProjectId,
      amount: transfer.amount,
      transferReason: transfer.transferReason || "",
      transferDate: transfer.transferDate,
      description: transfer.description || "",
    });
    setShowForm(true);
  };

  // إلغاء التعديل
  const cancelEdit = () => {
    setEditingTransfer(null);
    setShowForm(false);
    form.reset();
  };

  // حذف عملية ترحيل مع تأكيد
  const handleDelete = (transferId: string, fromProject: string, toProject: string) => {
    if (confirm(`هل أنت متأكد من حذف عملية الترحيل من ${fromProject} إلى ${toProject}؟`)) {
      deleteTransferMutation.mutate(transferId);
    }
  };

  // دالة لجلب اسم المشروع
  const getProjectName = (projectId: string) => {
    const project = projects.find((p: Project) => p.id === projectId);
    return project?.name || "غير محدد";
  };

  // فلترة التحويلات محلياً حسب المشروع المختار
  const filteredTransfers = currentProjectId && currentProjectId !== 'all' 
    ? allTransfers.filter(transfer => 
        transfer.fromProjectId === currentProjectId || 
        transfer.toProjectId === currentProjectId
      )
    : allTransfers;

  // حساب الإحصائيات بناءً على البيانات المفلترة
  const transferStats = {
    totalTransfers: filteredTransfers.length,
    totalAmount: filteredTransfers.reduce((sum, transfer) => sum + (parseFloat(transfer.amount?.toString() || '0') || 0), 0),
    outgoingTransfers: currentProjectId && currentProjectId !== 'all' 
      ? filteredTransfers.filter(t => t.fromProjectId === currentProjectId).length
      : 0,
    incomingTransfers: currentProjectId && currentProjectId !== 'all' 
      ? filteredTransfers.filter(t => t.toProjectId === currentProjectId).length
      : 0,
    outgoingAmount: currentProjectId && currentProjectId !== 'all' 
      ? filteredTransfers.filter(t => t.fromProjectId === currentProjectId).reduce((sum, t) => sum + (parseFloat(t.amount?.toString() || '0') || 0), 0)
      : 0,
    incomingAmount: currentProjectId && currentProjectId !== 'all' 
      ? filteredTransfers.filter(t => t.toProjectId === currentProjectId).reduce((sum, t) => sum + (parseFloat(t.amount?.toString() || '0') || 0), 0)
      : 0,
  };

  // حساب صافي التدفق (الوارد - الصادر)
  const netFlow = transferStats.incomingAmount - transferStats.outgoingAmount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ريال';
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 md:space-y-8" dir="rtl">
      {/* Page Header */}
      <div className="bg-card border rounded-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <ArrowRight className="h-6 w-6 md:h-7 md:w-7 text-primary" />
              تحويلات العهدة
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              إدارة وتتبع عمليات ترحيل الأموال بين المشاريع المختلفة
            </p>
          </div>
          <Button 
            onClick={() => {
              setShowForm(true);
              setEditingTransfer(null);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-11 px-6"
            data-testid="button-add-transfer-header"
          >
            <Plus className="h-4 w-4 ml-2" />
            إضافة عملية ترحيل
          </Button>
        </div>
      </div>

      {/* مكون اختيار المشروع */}
      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-lg md:text-xl font-bold text-foreground mb-3 flex items-center">
          <ChartGantt className="ml-2 h-5 w-5 text-primary" />
          اختر المشروع
        </h2>
        <ProjectSelector
          selectedProjectId={currentProjectId}
          onProjectChange={(projectId, projectName) => selectProject(projectId, projectName)}
          showHeader={false}
          variant="compact"
        />
      </div>

      {/* إحصائيات عمليات الترحيل */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm md:text-base text-muted-foreground">إجمالي العمليات</p>
              <p className="text-2xl md:text-3xl font-semibold text-foreground">{transferStats.totalTransfers}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowRight className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
        
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm md:text-base text-muted-foreground">إجمالي المبالغ</p>
              <p className="text-xl md:text-2xl font-semibold text-foreground">{formatCurrency(transferStats.totalAmount)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {currentProjectId && currentProjectId !== 'all' && (
          <>
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base text-muted-foreground">العمليات الصادرة</p>
                  <p className="text-2xl md:text-3xl font-semibold text-foreground">{transferStats.outgoingTransfers}</p>
                  <p className="text-xs md:text-sm text-red-600 dark:text-red-400">{formatCurrency(transferStats.outgoingAmount)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>
            
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm md:text-base text-muted-foreground">العمليات الواردة</p>
                  <p className="text-2xl md:text-3xl font-semibold text-foreground">{transferStats.incomingTransfers}</p>
                  <p className="text-xs md:text-sm text-green-600 dark:text-green-400">{formatCurrency(transferStats.incomingAmount)}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* بطاقة صافي التدفق */}
      {currentProjectId && currentProjectId !== 'all' && (
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm md:text-base text-muted-foreground">صافي التدفق</p>
              <p className={`text-2xl md:text-3xl font-semibold ${
                netFlow > 0 ? 'text-green-600 dark:text-green-400' : 
                netFlow < 0 ? 'text-red-600 dark:text-red-400' : 
                'text-foreground'
              }`}>
                {netFlow > 0 ? '+' : ''}{formatCurrency(netFlow)}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground">
                {netFlow > 0 ? 'زيادة في الرصيد' : netFlow < 0 ? 'نقص في الرصيد' : 'متزن الرصيد'}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              netFlow > 0 ? 'bg-green-100 dark:bg-green-900/20' : 
              netFlow < 0 ? 'bg-red-100 dark:bg-red-900/20' : 
              'bg-gray-100 dark:bg-gray-900/20'
            }`}>
              {netFlow > 0 ? (
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : netFlow < 0 ? (
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              ) : (
                <Minus className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* نموذج إضافة عملية ترحيل جديدة */}
      {showForm && (
        <div className="bg-card border rounded-lg">
          <div className="p-4 md:p-6 border-b">
            <h2 className="text-lg md:text-xl font-bold text-foreground">
              {editingTransfer ? 'تعديل عملية الترحيل' : 'إضافة عملية ترحيل جديدة'}
            </h2>
          </div>
          <div className="p-4 md:p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* المشروع المرسل */}
                  <FormField
                    control={form.control}
                    name="fromProjectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المشروع المرسل</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value} 
                            onValueChange={field.onChange}
                            data-testid="select-from-project"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المشروع المرسل" />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((project: Project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* المشروع المستلم */}
                  <FormField
                    control={form.control}
                    name="toProjectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المشروع المستلم</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value} 
                            onValueChange={field.onChange}
                            data-testid="select-to-project"
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المشروع المستلم" />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((project: Project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* المبلغ */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المبلغ (ر.ي)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="أدخل المبلغ"
                            {...field}
                            data-testid="input-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* تاريخ الترحيل */}
                  <FormField
                    control={form.control}
                    name="transferDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>تاريخ الترحيل</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-transfer-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* سبب الترحيل */}
                  <FormField
                    control={form.control}
                    name="transferReason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>سبب الترحيل</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="أدخل سبب الترحيل"
                            {...field}
                            value={field.value || ""}
                            data-testid="input-transfer-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* وصف الترحيل */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>وصف الترحيل (اختياري)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="أدخل وصف للترحيل"
                            {...field}
                            value={field.value || ""}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={createTransferMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-11"
                    data-testid="button-submit-transfer"
                  >
                    {createTransferMutation.isPending ? "جاري الحفظ..." : (editingTransfer ? "تحديث عملية الترحيل" : "حفظ عملية الترحيل")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                    className="h-11"
                    data-testid="button-cancel"
                  >
                    إلغاء
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      )}

      {/* قائمة عمليات الترحيل */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 md:p-6 border-b">
          <h2 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5" />
            سجل عمليات الترحيل
          </h2>
        </div>
        <div className="p-4 md:p-6">
          {transfersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <ArrowRight className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                لا توجد عمليات ترحيل
              </h3>
              <p className="text-sm md:text-base text-muted-foreground mb-4">
                {currentProjectId && currentProjectId !== 'all' 
                  ? "لم يتم إجراء عمليات ترحيل للمشروع المحدد بعد"
                  : "لم يتم إجراء عمليات ترحيل بين المشاريع بعد"
                }
              </p>
              <Button 
                onClick={() => {
                  setShowForm(true);
                  setEditingTransfer(null);
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-add-first-transfer"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة عملية ترحيل
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTransfers.map((transfer: ProjectFundTransfer) => {
                // تحديد اتجاه التحويل بالنسبة للمشروع المحدد
                const isOutgoing = currentProjectId !== 'all' && transfer.fromProjectId === currentProjectId;
                const isIncoming = currentProjectId !== 'all' && transfer.toProjectId === currentProjectId;
                
                return (
                  <div key={transfer.id} className="bg-card border rounded-lg p-4 hover:shadow-md transition-all duration-200" data-testid={`card-transfer-${transfer.id}`}>
                    <div className="flex items-start gap-4">
                      {/* المبلغ البارز */}
                      <div className="flex flex-col items-center">
                        <div className="text-2xl md:text-3xl font-semibold text-foreground mb-1">
                          {parseFloat(transfer.amount).toLocaleString()}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground">ريال</div>
                        
                        {/* Badge الاتجاه */}
                        {(isOutgoing || isIncoming) && (
                          <Badge 
                            variant={isOutgoing ? "destructive" : "default"}
                            className="mt-2 text-xs"
                          >
                            {isOutgoing ? 'صادر' : 'وارد'}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        {/* المسار كثانوي */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm md:text-base font-medium text-muted-foreground">
                            {getProjectName(transfer.fromProjectId)}
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm md:text-base font-medium text-muted-foreground">
                            {getProjectName(transfer.toProjectId)}
                          </span>
                        </div>
                        
                        {/* التاريخ بنص مخفف */}
                        <div className="flex items-center gap-1 mb-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs md:text-sm text-muted-foreground">
                            {new Date(transfer.transferDate).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        
                        {/* السبب والوصف */}
                        {(transfer.transferReason || transfer.description) && (
                          <div className="space-y-1 text-sm md:text-base">
                            {transfer.transferReason && (
                              <div className="text-foreground">
                                <span className="font-medium">السبب:</span> {transfer.transferReason}
                              </div>
                            )}
                            {transfer.description && (
                              <div className="text-muted-foreground">
                                <span className="font-medium">ملاحظات:</span> {transfer.description}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-muted-foreground">
                            ID: {transfer.id.slice(0, 8)}
                          </span>
                          
                          {/* أزرار العمليات المحسنة */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(transfer)}
                              className="h-11 min-w-11 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              data-testid={`button-edit-${transfer.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(
                                transfer.id, 
                                getProjectName(transfer.fromProjectId), 
                                getProjectName(transfer.toProjectId)
                              )}
                              className="h-11 min-w-11 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                              disabled={deleteTransferMutation.isPending}
                              data-testid={`button-delete-${transfer.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}