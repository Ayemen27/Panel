/**
 * الوصف: صفحة إدارة المصاريف اليومية والتحويلات المالية
 * المدخلات: تاريخ محدد ومعرف المشروع
 * المخرجات: عرض وإدارة جميع المصاريف والتحويلات اليومية
 * المالك: عمار
 * آخر تعديل: 2025-08-20
 * الحالة: نشط - الصفحة الأساسية لإدارة المصاريف
 */

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Save, Users, Car, Plus, Edit2, Trash2, ChevronDown, ChevronUp, ArrowLeftRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSelectedProject } from "@/hooks/use-selected-project";
import ProjectSelector from "@/components/project-selector";
import ExpenseSummary from "@/components/expense-summary";
import WorkerMiscExpenses from "./worker-misc-expenses";
import { getCurrentDate, formatCurrency, formatDate, cleanNumber } from "@/lib/utils";
import { AutocompleteInput } from "@/components/ui/autocomplete-input-database";
import { apiRequest } from "@/lib/queryClient";
import { useFloatingButton } from "@/components/layout/floating-button-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { 
  WorkerAttendance, 
  TransportationExpense, 
  FundTransfer,
  MaterialPurchase,
  WorkerTransfer,
  Worker,
  Project,
  InsertFundTransfer,
  InsertTransportationExpense,
  InsertDailyExpenseSummary,
  ProjectFundTransfer 
} from "@shared/schema";

// إزالة تعريف ErrorBoundary المحلي لتجنب التكرار - يتم استيراده من components/ErrorBoundary

function DailyExpensesContent() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectProject } = useSelectedProject();
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [carriedForward, setCarriedForward] = useState<string>("0");
  const [showProjectTransfers, setShowProjectTransfers] = useState<boolean>(true);

  // Fund transfer form
  const [fundAmount, setFundAmount] = useState<string>("");
  const [senderName, setSenderName] = useState<string>("");
  const [transferNumber, setTransferNumber] = useState<string>("");
  const [transferType, setTransferType] = useState<string>("");
  const [editingFundTransferId, setEditingFundTransferId] = useState<string | null>(null);

  // Transportation expense form
  const [transportDescription, setTransportDescription] = useState<string>("");
  const [transportAmount, setTransportAmount] = useState<string>("");
  const [transportNotes, setTransportNotes] = useState<string>("");
  const [editingTransportationId, setEditingTransportationId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setFloatingAction } = useFloatingButton();

  // دالة مساعدة لحفظ قيم الإكمال التلقائي
  const saveAutocompleteValue = async (field: string, value: string) => {
    if (!value || value.trim().length < 2) return;

    try {
      // التحقق من أن endpoint autocomplete موجود قبل المحاولة
      const response = await fetch('/api/autocomplete', { method: 'HEAD' });
      if (!response.ok) {
        console.warn(`Autocomplete endpoint not available for ${field}`);
        return;
      }

      await apiRequest('/api/autocomplete', 'POST', {
        category: field,
        value: value.trim(),
        usageCount: 1
      });
      console.log(`✅ تم حفظ قيمة الإكمال التلقائي: ${field} = ${value.trim()}`);
    } catch (error) {
      console.warn(`Failed to save autocomplete value for ${field}:`, error);
      // تجاهل الخطأ دون مقاطعة التطبيق
    }
  };

  // تعيين إجراء الزر العائم لحفظ المصاريف
  useEffect(() => {
    const handleSaveExpenses = () => {
      // محاكاة كليك زر الحفظ
      const saveButton = document.querySelector('[type="submit"]') as HTMLButtonElement;
      if (saveButton) {
        saveButton.click();
      }
    };

    setFloatingAction(handleSaveExpenses, "حفظ المصاريف");
    return () => setFloatingAction(null);
  }, [setFloatingAction]);

  // دالة لحفظ جميع قيم الإكمال التلقائي للحولة
  const saveAllFundTransferAutocompleteValues = async () => {
    const promises = [];

    if (senderName && senderName.trim().length >= 2) {
      promises.push(saveAutocompleteValue('senderNames', senderName));
    }

    if (transferNumber && transferNumber.trim().length >= 1) {
      promises.push(saveAutocompleteValue('transferNumbers', transferNumber));
    }

    if (transferType && transferType.trim().length >= 2) {
      promises.push(saveAutocompleteValue('transferTypes', transferType));
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  };

  const { data: workers = [], error: workersError } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
    queryFn: async () => {
      try {
        console.log('🔄 [DailyExpenses] جلب قائمة العمال...');
        const response = await apiRequest("/api/workers", "GET");
        console.log('📊 [DailyExpenses] استجابة العمال:', response);

        // معالجة هيكل الاستجابة المتعددة
        let workers = [];
        if (response && typeof response === 'object') {
          if (response.success !== undefined && response.data !== undefined) {
            workers = Array.isArray(response.data) ? response.data : [];
          } else if (Array.isArray(response)) {
            workers = response;
          } else if (response.id) {
            workers = [response];
          } else if (response.data) {
            workers = Array.isArray(response.data) ? response.data : [];
          }
        }

        if (!Array.isArray(workers)) {
          console.warn('⚠️ [DailyExpenses] بيانات العمال ليست مصفوفة، تحويل إلى مصفوفة فارغة');
          workers = [];
        }

        console.log(`✅ [DailyExpenses] تم جلب ${workers.length} عامل`);
        return workers as Worker[];
      } catch (error) {
        console.error('❌ [DailyExpenses] خطأ في جلب العمال:', error);
        return [] as Worker[];
      }
    },
    staleTime: 300000, // 5 دقائق
    gcTime: 600000, // 10 دقائق
    retry: 2,
  });

  // جلب قائمة المشاريع لعرض أسماء المشاريع في ترحيل الأموال مع معالجة محسنة
  const { data: projects = [], error: projectsError } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      try {
        console.log('🔄 [DailyExpenses] جلب قائمة المشاريع...');
        const response = await apiRequest("/api/projects", "GET");
        console.log('📊 [DailyExpenses] استجابة المشاريع:', response);

        // معالجة هيكل الاستجابة المتعددة
        let projects = [];
        if (response && typeof response === 'object') {
          if (response.success !== undefined && response.data !== undefined) {
            projects = Array.isArray(response.data) ? response.data : [];
          } else if (Array.isArray(response)) {
            projects = response;
          } else if (response.id) {
            projects = [response];
          } else if (response.data) {
            projects = Array.isArray(response.data) ? response.data : [];
          }
        }

        if (!Array.isArray(projects)) {
          console.warn('⚠️ [DailyExpenses] البيانات ليست مصفوفة، تحويل إلى مصفوفة فارغة');
          projects = [];
        }

        console.log(`✅ [DailyExpenses] تم جلب ${projects.length} مشروع`);
        return projects as Project[];
      } catch (error) {
        console.error('❌ [DailyExpenses] خطأ في جلب المشاريع:', error);
        return [] as Project[];
      }
    },
    staleTime: 300000, // 5 دقائق
    retry: 2,
  });

  // سيتم تعريف المتغيرات الآمنة بعد جلب البيانات من dailyExpensesData

  // جلب معلومات المواد مع معالجة آمنة للأخطاء
  const { data: materials = [] } = useQuery({
    queryKey: ["/api/materials"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/materials", "GET");
        // التأكد من أن النتيجة مصفوفة
        if (response && response.data && Array.isArray(response.data)) {
          return response.data;
        }
        // إذا لم تكن مصفوفة، أرجع مصفوفة فارغة
        return [];
      } catch (error) {
        console.warn('⚠️ لم يتمكن من جلب المواد، استخدام قائمة فارغة:', error);
        return [];
      }
    },
    staleTime: 300000, // 5 دقائق
    gcTime: 600000, // 10 دقائق
  });

  // سيتم تعريف المتغيرات الآمنة بعد جلب البيانات من dailyExpensesData

  // جلب عمليات ترحيل الأموال بين المشاريع مع أسماء المشاريع - استعلام منفصل للصفحة اليومية
  const { data: projectTransfers = [] } = useQuery<(ProjectFundTransfer & { fromProjectName?: string; toProjectName?: string })[]>({
    queryKey: ["/api/daily-project-transfers", selectedProjectId, selectedDate],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/daily-project-transfers?projectId=${selectedProjectId}&date=${selectedDate}`, "GET");
        console.log('📊 [ProjectTransfers] استجابة API للصفحة اليومية:', response);

        // معالجة الهيكل المتداخل للاستجابة
        let transferData = [];
        if (response && response.data && Array.isArray(response.data)) {
          transferData = response.data;
        } else if (Array.isArray(response)) {
          transferData = response;
        }

        if (!Array.isArray(transferData)) return [];

        console.log(`✅ [ProjectTransfers] تم جلب ${transferData.length} ترحيل لليوم ${selectedDate} في الصفحة اليومية`);
        
        // البيانات تأتي مع أسماء المشاريع من الخادم مباشرة
        return transferData;
      } catch (error) {
        console.error("Error fetching daily project transfers:", error);
        return [];
      }
    },
    enabled: !!selectedProjectId && !!selectedDate && showProjectTransfers,
    staleTime: 60000, // البيانات صالحة لدقيقة واحدة
    gcTime: 300000, // الاحتفاظ بالذاكرة لـ 5 دقائق
  });

  // معالجة آمنة لترحيل المشاريع
  const safeProjectTransfers = Array.isArray(projectTransfers) ? projectTransfers : [];

  // جلب البيانات الموحدة للمصروفات اليومية
  const { data: dailyExpensesData, isLoading: dailyExpensesLoading, error: dailyExpensesError } = useQuery({
    queryKey: ["/api/projects", selectedProjectId, "daily-expenses", selectedDate],
    queryFn: async () => {
      if (!selectedProjectId || !selectedDate) {
        return null;
      }

      try {
        console.log(`📊 جلب المصروفات اليومية: مشروع ${selectedProjectId}, تاريخ ${selectedDate}`);
        const response = await apiRequest(`/api/projects/${selectedProjectId}/daily-expenses/${selectedDate}`, "GET");

        console.log('📊 استجابة المصروفات اليومية:', response);

        if (response && response.success && response.data) {
          return response.data;
        }

        return null;
      } catch (error) {
        console.error("خطأ في جلب المصروفات اليومية:", error);
        throw error;
      }
    },
    enabled: !!selectedProjectId && !!selectedDate,
    retry: 2,
    staleTime: 30000,
  });

  // استخراج البيانات من الاستجابة الموحدة
  const todayFundTransfers = dailyExpensesData?.fundTransfers || [];
  const todayWorkerAttendance = dailyExpensesData?.workerAttendance || [];
  const todayTransportation = dailyExpensesData?.transportationExpenses || [];
  const todayMaterialPurchases = dailyExpensesData?.materialPurchases || [];
  const todayWorkerTransfers = dailyExpensesData?.workerTransfers || [];
  const todayMiscExpenses = dailyExpensesData?.miscExpenses || [];

  // معالجة آمنة للبيانات - التأكد من أن البيانات مصفوفات
  const safeAttendance = Array.isArray(todayWorkerAttendance) ? todayWorkerAttendance : [];
  const safeTransportation = Array.isArray(todayTransportation) ? todayTransportation : [];
  const safeMaterialPurchases = Array.isArray(todayMaterialPurchases) ? todayMaterialPurchases : [];
  const safeWorkerTransfers = Array.isArray(todayWorkerTransfers) ? todayWorkerTransfers : [];
  const safeMiscExpenses = Array.isArray(todayMiscExpenses) ? todayMiscExpenses : [];
  const safeFundTransfers = Array.isArray(todayFundTransfers) ? todayFundTransfers : [];

  // جلب الرصيد المتبقي من اليوم السابق
  const { data: previousBalance } = useQuery({
    queryKey: ["/api/projects", selectedProjectId, "previous-balance", selectedDate],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/projects/${selectedProjectId}/previous-balance/${selectedDate}`, "GET");
        // معالجة الهيكل المتداخل للاستجابة
        if (response && response.data && response.data.balance !== undefined) {
          return response.data.balance || "0";
        }
        return response?.balance || "0";
      } catch (error) {
        console.error("Error fetching previous balance:", error);
        return "0";
      }
    },
    enabled: !!selectedProjectId && !!selectedDate,
  });

  // تحديث المبلغ المرحل تلقائياً عند جلب الرصيد السابق
  useEffect(() => {
    if (previousBalance !== null && previousBalance !== undefined) {
      console.log('🔄 تحديث carriedForward:', { previousBalance, type: typeof previousBalance });
      setCarriedForward(previousBalance);
    }
  }, [previousBalance]);

  // تهيئة قيم الإكمال التلقائي الافتراضية لنوع التحويل
  useEffect(() => {
    const initializeDefaultTransferTypes = async () => {
      const defaultTypes = ['حولة بنكية', 'تسليم يدوي', 'صراف آلي', 'تحويل داخلي', 'شيك', 'نقدية'];

      for (const type of defaultTypes) {
        try {
          await saveAutocompleteValue('transferTypes', type);
        } catch (error) {
          // تجاهل الأخطاء بهدوء
          console.log(`Type ${type} initialization skipped:`, error);
        }
      }
    };

    // تهيئة القيم مرة واحدة فقط عند تحميل المكون
    initializeDefaultTransferTypes();
  }, []);

  const addFundTransferMutation = useMutation({
    mutationFn: async (data: InsertFundTransfer) => {
      // حفظ جميع قيم الإكمال التلقائي قبل العملية الأساسية
      await saveAllFundTransferAutocompleteValues();

      // تنفيذ العملية الأساسية
      return apiRequest("/api/fund-transfers", "POST", data);
    },
    onSuccess: async (newTransfer) => {
      // ✅ إصلاح: تحديث فوري للبيانات الأساسية
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", selectedProjectId, "daily-expenses", selectedDate] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", selectedProjectId, "previous-balance"] 
      });

      toast({
        title: "تم إضافة العهدة",
        description: "تم إضافة تحويل العهدة بنجاح",
      });

      // تحديث كاش autocomplete للتأكد من ظهور البيانات الجديدة
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });

      // تنظيف النموذج
      setFundAmount("");
      setSenderName("");
      setTransferNumber("");
      setTransferType("");
    },
    onError: async (error: any) => {
      // حفظ جميع قيم الإكمال التلقائي حتى في حالة الخطأ
      await saveAllFundTransferAutocompleteValues();

      // تحديث كاش autocomplete
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });

      console.error("خطأ في إضافة الحولة:", error);

      let errorMessage = "حدث خطأ أثناء إضافة الحولة";

      // معالجة أنواع مختلفة من الأخطاء
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({
        title: "فشل في إضافة الحولة",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const addTransportationMutation = useMutation({
    mutationFn: async (data: InsertTransportationExpense) => {
      // حفظ قيم الإكمال التلقائي قبل العملية الأساسية
      await Promise.all([
        saveAutocompleteValue('transportDescriptions', transportDescription),
        saveAutocompleteValue('notes', transportNotes)
      ]);

      // تنفيذ العملية الأساسية
      return apiRequest("/api/transportation-expenses", "POST", data);
    },
    onSuccess: async (newExpense) => {
      // ✅ إصلاح: تحديث فوري للبيانات الأساسية
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", selectedProjectId, "daily-expenses", selectedDate] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", selectedProjectId, "previous-balance"] 
      });

      toast({
        title: "تم إضافة المواصلات",
        description: "تم إضافة مصروف المواصلات بنجاح",
      });

      // تحديث كاش autocomplete للتأكد من ظهور البيانات الجديدة
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });

      // تنظيف النموذج
      setTransportDescription("");
      setTransportAmount("");
      setTransportNotes("");
    },
    onError: async (error) => {
      // حفظ قيم الإكمال التلقائي حتى في حالة الخطأ
      await Promise.all([
        saveAutocompleteValue('transportDescriptions', transportDescription),
        saveAutocompleteValue('notes', transportNotes)
      ]);

      // تحديث كاش autocomplete
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });

      toast({
        title: "خطأ في إضافة المواصلات",
        description: error?.message || "حدث خطأ أثناء إضافة مصروف المواصلات",
        variant: "destructive",
      });
    },
  });

  const saveDailySummaryMutation = useMutation({
    mutationFn: (data: InsertDailyExpenseSummary) => apiRequest("/api/daily-expense-summaries", "POST", data),
    onSuccess: () => {
      toast({
        title: "تم الحفظ",
        description: "تم حفظ ملخص المصروفات اليومية بنجاح",
      });

      // تحديث ملخص اليوم
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", selectedProjectId, "daily-summary", selectedDate] 
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الملخص",
        variant: "destructive",
      });
    },
  });

  // Delete mutations
  const deleteFundTransferMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/fund-transfers/${id}`, "DELETE"),
    onMutate: () => {
      // حفظ القيم الحالية لتجنب Race Condition
      return {
        projectId: selectedProjectId,
        date: selectedDate
      };
    },
    onSuccess: (_, id, context) => {
      // استخدام القيم المحفوظة من onMutate
      const { projectId, date } = context || { projectId: selectedProjectId, date: selectedDate };
      
      // تحديث فوري للقائمة باستخدام setQueryData
      queryClient.setQueryData(["/api/projects", projectId, "daily-expenses", date], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          fundTransfers: oldData.fundTransfers?.filter((transfer: any) => transfer.id !== id) || []
        };
      });
      
      // إبطال الكاش للتأكد من التحديث الكامل
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "daily-expenses", date] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "previous-balance"] 
      });
      
      toast({ 
        title: "تم الحذف", 
        description: "تم حذف العهدة بنجاح" 
      });
    },
    onError: (error: any) => {
      console.error("خطأ في حذف الحولة:", error);

      let errorMessage = "حدث خطأ أثناء حذف الحولة";

      // معالجة محسنة للأخطاء
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({ 
        title: "فشل في حذف الحولة", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  const deleteTransportationMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/transportation-expenses/${id}`, "DELETE"),
    onMutate: () => {
      // حفظ القيم الحالية لتجنب Race Condition
      return {
        projectId: selectedProjectId,
        date: selectedDate
      };
    },
    onSuccess: (_, id, context) => {
      // استخدام القيم المحفوظة من onMutate
      const { projectId, date } = context || { projectId: selectedProjectId, date: selectedDate };
      
      // تحديث فوري للقائمة باستخدام setQueryData
      queryClient.setQueryData(["/api/projects", projectId, "daily-expenses", date], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          transportationExpenses: oldData.transportationExpenses?.filter((expense: any) => expense.id !== id) || []
        };
      });
      
      // إبطال الكاش للتأكد من التحديث الكامل
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "daily-expenses", date] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "previous-balance"] 
      });
      
      toast({ 
        title: "تم الحذف", 
        description: "تم حذف مصروف المواصلات بنجاح" 
      });
    },
    onError: (error: any) => {
      console.error("خطأ في حذف مصروف المواصلات:", error);

      let errorMessage = "حدث خطأ أثناء حذف مصروف المواصلات";

      // معالجة محسنة للأخطاء
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({ 
        title: "فشل في حذف مصروف المواصلات", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  const deleteMaterialPurchaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/material-purchases/${id}`, "DELETE"),
    onMutate: () => {
      // حفظ القيم الحالية لتجنب Race Condition
      return {
        projectId: selectedProjectId,
        date: selectedDate
      };
    },
    onSuccess: (_, id, context) => {
      // استخدام القيم المحفوظة من onMutate
      const { projectId, date } = context || { projectId: selectedProjectId, date: selectedDate };
      
      // تحديث فوري للقائمة باستخدام setQueryData
      queryClient.setQueryData(["/api/projects", projectId, "daily-expenses", date], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          materialPurchases: oldData.materialPurchases?.filter((purchase: any) => purchase.id !== id) || []
        };
      });
      
      // إبطال الكاش للتأكد من التحديث الكامل
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "daily-expenses", date] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "material-purchases"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "previous-balance"] 
      });
      
      toast({ 
        title: "تم الحذف", 
        description: "تم حذف شراء المواد بنجاح" 
      });
    },
    onError: (error: any) => {
      console.error("خطأ في حذف شراء المواد:", error);

      let errorMessage = "حدث خطأ أثناء حذف شراء المواد";

      // معالجة محسنة للأخطاء
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({ 
        title: "فشل في حذف شراء المواد", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  const deleteWorkerAttendanceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/worker-attendance/${id}`, "DELETE"),
    onMutate: () => {
      // حفظ القيم الحالية لتجنب Race Condition
      return {
        projectId: selectedProjectId,
        date: selectedDate
      };
    },
    onSuccess: (_, id, context) => {
      // استخدام القيم المحفوظة من onMutate
      const { projectId, date } = context || { projectId: selectedProjectId, date: selectedDate };
      
      // تحديث فوري للقائمة باستخدام setQueryData
      queryClient.setQueryData(["/api/projects", projectId, "daily-expenses", date], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          workerAttendance: oldData.workerAttendance?.filter((attendance: any) => attendance.id !== id) || []
        };
      });
      
      // إبطال الكاش للتأكد من التحديث الكامل
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "daily-expenses", date] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "attendance"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "previous-balance"] 
      });
      
      toast({ 
        title: "تم الحذف", 
        description: "تم حذف حضور العامل بنجاح" 
      });
    },
    onError: (error: any) => {
      console.error("خطأ في حذف حضور العامل:", error);

      let errorMessage = "حدث خطأ أثناء حذف حضور العامل";

      // معالجة محسنة للأخطاء
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({ 
        title: "فشل في حذف حضور العامل", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  const deleteWorkerTransferMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/worker-transfers/${id}`, "DELETE"),
    onMutate: () => {
      // حفظ القيم الحالية لتجنب Race Condition
      return {
        projectId: selectedProjectId,
        date: selectedDate
      };
    },
    onSuccess: (_, id, context) => {
      // استخدام القيم المحفوظة من onMutate
      const { projectId, date } = context || { projectId: selectedProjectId, date: selectedDate };
      
      // تحديث فوري للقائمة باستخدام setQueryData
      queryClient.setQueryData(["/api/projects", projectId, "daily-expenses", date], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          workerTransfers: oldData.workerTransfers?.filter((transfer: any) => transfer.id !== id) || []
        };
      });
      
      // إبطال الكاش للتأكد من التحديث الكامل
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "daily-expenses", date] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", projectId, "previous-balance"] 
      });
      
      toast({ 
        title: "تم الحذف", 
        description: "تم حذف حوالة العامل بنجاح" 
      });
    },
    onError: (error: any) => {
      console.error("خطأ في حذف حوالة العامل:", error);

      let errorMessage = "حدث خطأ أثناء حذف حوالة العامل";

      // معالجة محسنة للأخطاء
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({ 
        title: "فشل في حذف حوالة العامل", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  });

  // Fund Transfer Update Mutation
  const updateFundTransferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/fund-transfers/${id}`, "PATCH", data),
    onSuccess: async (updatedTransfer, { id }) => {
      // تحديث daily-expenses query حيث تأتي بيانات fund transfers
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "daily-expenses", selectedDate] });
      // تحديث previous-balance للأيام التالية لأن التعديل يؤثر على الرصيد
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "previous-balance"] });

      // حفظ قيم الإكمال التلقائي
      if (senderName) await saveAutocompleteValue('senderNames', senderName);
      if (transferNumber) await saveAutocompleteValue('transferNumbers', transferNumber);

      // تحديث كاش autocomplete للتأكد من ظهور البيانات الجديدة
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });

      resetFundTransferForm();
      toast({
        title: "تم التحديث",
        description: "تم تحديث العهدة بنجاح",
      });
    },
    onError: (error: any) => {
      console.error("خطأ في تحديث الحولة:", error);

      let errorMessage = "حدث خطأ أثناء تحديث الحولة";

      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "فشل في تحديث الحولة",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const resetFundTransferForm = () => {
    setFundAmount("");
    setSenderName("");
    setTransferNumber("");
    setTransferType("");
    setEditingFundTransferId(null);
  };

  const handleEditFundTransfer = (transfer: FundTransfer) => {
    setFundAmount(transfer.amount);
    setSenderName(transfer.senderName || "");
    setTransferNumber(transfer.transferNumber || "");
    setTransferType(transfer.transferType);
    setEditingFundTransferId(transfer.id);
  };

  const handleAddFundTransfer = () => {
    // التحقق من البيانات المطلوبة
    if (!selectedProjectId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار المشروع أولاً",
        variant: "destructive",
      });
      return;
    }

    if (!fundAmount || fundAmount.trim() === "" || parseFloat(fundAmount) <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
        variant: "destructive",
      });
      return;
    }

    if (!transferType || transferType.trim() === "") {
      toast({
        title: "خطأ",
        description: "يرجى اختيار نوع التحويل",
        variant: "destructive",
      });
      return;
    }

    const transferData = {
      projectId: selectedProjectId,
      amount: fundAmount.toString(),
      senderName: senderName.trim() || "غير محدد",
      transferNumber: transferNumber.trim() || null,
      transferType: transferType,
      transferDate: new Date(selectedDate + 'T12:00:00.000Z'),
      notes: "",
    };

    if (editingFundTransferId) {
      updateFundTransferMutation.mutate({
        id: editingFundTransferId,
        data: transferData
      });
    } else {
      addFundTransferMutation.mutate(transferData);
    }
  };

  // Transportation Update Mutation
  const updateTransportationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/transportation-expenses/${id}`, "PATCH", data),
    onSuccess: async (updatedExpense, { id }) => {
      // تحديث daily-expenses query حيث تأتي بيانات transportation expenses
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "daily-expenses", selectedDate] });
      // تحديث previous-balance للأيام التالية لأن التعديل يؤثر على الرصيد
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "previous-balance"] });

      // حفظ قيم الإكمال التلقائي
      if (transportDescription) await saveAutocompleteValue('transportDescriptions', transportDescription);
      if (transportNotes) await saveAutocompleteValue('notes', transportNotes);

      resetTransportationForm();
      toast({
        title: "تم التحديث",
        description: "تم تحديث مصروف المواصلات بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحديث المصروف",
        variant: "destructive",
      });
    }
  });

  const resetTransportationForm = () => {
    setTransportDescription("");
    setTransportAmount("");
    setTransportNotes("");
    setEditingTransportationId(null);
  };

  const handleEditTransportation = (expense: TransportationExpense) => {
    setTransportDescription(expense.description);
    setTransportAmount(expense.amount);
    setTransportNotes(expense.notes || "");
    setEditingTransportationId(expense.id);
  };

  const handleAddTransportation = () => {
    if (!selectedProjectId || !transportDescription || !transportAmount) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع البيانات المطلوبة",
        variant: "destructive",
      });
      return;
    }

    const transportData = {
      projectId: selectedProjectId,
      amount: transportAmount,
      description: transportDescription,
      date: selectedDate,
      notes: transportNotes,
    };

    if (editingTransportationId) {
      updateTransportationMutation.mutate({
        id: editingTransportationId,
        data: transportData
      });
    } else {
      addTransportationMutation.mutate(transportData);
    }
  };

  const calculateTotals = () => {
    try {
      // إنشاء متغيرات آمنة لجميع البيانات مع فحص إضافي
      const safeAttendance = Array.isArray(todayWorkerAttendance) ? 
        todayWorkerAttendance.filter(item => item && typeof item === 'object') : [];
      const safeTransportation = Array.isArray(todayTransportation) ? 
        todayTransportation.filter(item => item && typeof item === 'object') : [];
      const safeMaterialPurchases = Array.isArray(todayMaterialPurchases) ? 
        todayMaterialPurchases.filter(item => item && typeof item === 'object') : [];
      const safeWorkerTransfers = Array.isArray(todayWorkerTransfers) ? 
        todayWorkerTransfers.filter(item => item && typeof item === 'object') : [];
      const safeMiscExpenses = Array.isArray(todayMiscExpenses) ? 
        todayMiscExpenses.filter(item => item && typeof item === 'object') : [];
      const safeFundTransfers = Array.isArray(todayFundTransfers) ? 
        todayFundTransfers.filter(item => item && typeof item === 'object') : [];
      const safeProjectTransfers = Array.isArray(projectTransfers) ? 
        projectTransfers.filter(item => item && typeof item === 'object') : [];

      // تسجيل مبسط للحسابات المالية
      if (process.env.NODE_ENV === 'development') {
        console.log('🧮 [DailyExpenses] إجمالي البيانات المنظفة:', {
          حضور: safeAttendance.length,
          نقل: safeTransportation.length,
          مشتريات: safeMaterialPurchases.length,
          تحويلات_عمال: safeWorkerTransfers.length,
          مصاريف_أخرى: safeMiscExpenses.length,
          تحويلات_أموال: safeFundTransfers.length,
          تحويلات_مشاريع: safeProjectTransfers.length
        });
      }

      // استخدام دالة cleanNumber المحسنة
      const totalWorkerWages = safeAttendance.reduce(
        (sum, attendance) => {
          const amount = cleanNumber(attendance.paidAmount);
          return sum + amount;
        }, 
        0
      );

      const totalTransportation = safeTransportation.reduce(
        (sum, expense) => {
          const amount = cleanNumber(expense.amount);
          return sum + amount;
        }, 
        0
      );

      // حساب المشتريات النقدية فقط - استخدام البيانات الآمنة
      const totalMaterialCosts = safeMaterialPurchases
        .filter(purchase => purchase.purchaseType === "نقد")
        .reduce((sum, purchase) => {
          const amount = cleanNumber(purchase.totalAmount);
          return sum + amount;
        }, 0);

      const totalWorkerTransfers = safeWorkerTransfers.reduce(
        (sum, transfer) => {
          const amount = cleanNumber(transfer.amount);
          return sum + amount;
        }, 0);

      const totalMiscExpenses = safeMiscExpenses.reduce(
        (sum, expense) => {
          const amount = cleanNumber(expense.amount);
          return sum + amount;
        }, 0);

      const totalFundTransfers = safeFundTransfers.reduce(
        (sum, transfer) => {
          const amount = cleanNumber(transfer.amount);
          return sum + amount;
        }, 0);

      // حساب الأموال الواردة والصادرة من ترحيل المشاريع
      const incomingProjectTransfers = safeProjectTransfers
        .filter(transfer => transfer.toProjectId === selectedProjectId)
        .reduce((sum, transfer) => {
          const amount = cleanNumber(transfer.amount);
          return sum + amount;
        }, 0);

      const outgoingProjectTransfers = safeProjectTransfers
        .filter(transfer => transfer.fromProjectId === selectedProjectId)
        .reduce((sum, transfer) => {
          const amount = cleanNumber(transfer.amount);
          return sum + amount;
        }, 0);

      // تطبيق المنطق الصحيح من النسخة الاحتياطية - استخدام cleanNumber للاتساق
      const carriedAmount = cleanNumber(carriedForward);
      
      console.log('🧮 [calculateTotals] تفاصيل الحساب:', {
        carriedForward,
        carriedAmount,
        totalFundTransfers,
        incomingProjectTransfers,
        calculation: `${carriedAmount} + ${totalFundTransfers} + ${incomingProjectTransfers}`,
      });
      
      const totalIncome = carriedAmount + totalFundTransfers + incomingProjectTransfers;
      const totalExpenses = totalWorkerWages + totalTransportation + totalMaterialCosts + 
                            totalWorkerTransfers + totalMiscExpenses + outgoingProjectTransfers;
      const remainingBalance = totalIncome - totalExpenses;
      
      console.log('✅ [calculateTotals] النتيجة النهائية:', {
        totalIncome,
        totalExpenses,
        remainingBalance
      });

      // تسجيل تفصيلي للحسابات
      if (process.env.NODE_ENV === 'development') {
        console.log('💰 تفاصيل الحسابات:', {
          carriedForward: carriedForward,
          carriedAmount: carriedAmount,
          totalFundTransfers: totalFundTransfers,
          incomingProjectTransfers: incomingProjectTransfers,
          totalIncome: totalIncome,
          totalExpenses: totalExpenses,
          remainingBalance: remainingBalance
        });
      }

      const result = {
        totalWorkerWages: totalWorkerWages,
        totalTransportation: totalTransportation,
        totalMaterialCosts: totalMaterialCosts,
        totalWorkerTransfers: totalWorkerTransfers,
        totalMiscExpenses: totalMiscExpenses,
        totalFundTransfers: totalFundTransfers,
        incomingProjectTransfers: incomingProjectTransfers,
        outgoingProjectTransfers: outgoingProjectTransfers,
        totalIncome: totalIncome, // يمكن أن يكون سالباً حسب المبلغ المرحل
        totalExpenses: totalExpenses,
        remainingBalance: remainingBalance, // يمكن أن يكون سالباً
      };

      // فحص النتائج للتأكد من عدم وجود قيم غير منطقية
      const maxReasonableAmount = 100000000; // 100 مليون
      Object.keys(result).forEach(key => {
        const value = (result as any)[key];
        if (typeof value === 'number' && Math.abs(value) > maxReasonableAmount) {
          console.warn(`⚠️ [DailyExpenses] قيمة غير منطقية في ${key}:`, value);
          if (key !== 'remainingBalance') {
            (result as any)[key] = 0; // إعادة تعيين القيم غير المنطقية إلى الصفر
          }
        }
      });

      // تسجيل النتائج في بيئة التطوير فقط
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ الملخص المالي النهائي:', {
          إجمالي_الدخل: formatCurrency(result.totalIncome),
          إجمالي_المصاريف: formatCurrency(result.totalExpenses),
          الرصيد_المتبقي: formatCurrency(result.remainingBalance)
        });
      }
      return result;

    } catch (error) {
      console.error('❌ [DailyExpenses] خطأ في calculateTotals:', error);
      // إرجاع قيم افتراضية آمنة في حالة حدوث خطأ
      return {
        totalWorkerWages: 0,
        totalTransportation: 0,
        totalMaterialCosts: 0,
        totalWorkerTransfers: 0,
        totalMiscExpenses: 0,
        totalFundTransfers: 0,
        incomingProjectTransfers: 0,
        outgoingProjectTransfers: 0,
        totalIncome: 0,
        totalExpenses: 0,
        remainingBalance: 0,
      };
    }
  };

  const handleSaveSummary = () => {
    if (!selectedProjectId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار المشروع أولاً",
        variant: "destructive",
      });
      return;
    }

    const totals = calculateTotals();

    saveDailySummaryMutation.mutate({
      projectId: selectedProjectId,
      date: selectedDate,
      carriedForwardAmount: carriedForward,
      totalFundTransfers: totals.totalFundTransfers.toString(),
      totalWorkerWages: totals.totalWorkerWages.toString(),
      totalMaterialCosts: totals.totalMaterialCosts.toString(),
      totalTransportationCosts: totals.totalTransportation.toString(),

      totalIncome: totals.totalIncome.toString(),
      totalExpenses: totals.totalExpenses.toString(),
      remainingBalance: totals.remainingBalance.toString(),
    });
  };

  // حساب المجاميع مع معالجة آمنة للأخطاء
  const totals = useMemo(() => {
    try {
      const result = calculateTotals();
      if (!result || typeof result !== 'object') {
        console.warn('⚠️ [DailyExpenses] calculateTotals returned invalid result:', result);
        throw new Error('Invalid result from calculateTotals');
      }
      return result;
    } catch (error) {
      console.error('❌ [DailyExpenses] خطأ في حساب المجاميع:', error);
      return {
        totalWorkerWages: 0,
        totalTransportation: 0,
        totalMaterialCosts: 0,
        totalWorkerTransfers: 0,
        totalMiscExpenses: 0,
        totalFundTransfers: 0,
        incomingProjectTransfers: 0,
        outgoingProjectTransfers: 0,
        totalIncome: 0,
        totalExpenses: 0,
        remainingBalance: 0,
      };
    }
  }, [
    todayWorkerAttendance,
    todayTransportation,
    todayMaterialPurchases,
    todayWorkerTransfers,
    todayMiscExpenses,
    todayFundTransfers,
    projectTransfers,
    carriedForward,
    selectedProjectId
  ]);

  // حساب مؤشرات البيانات المتوفرة مع معالجة آمنة
  const dataIndicators = {
    fundTransfers: Array.isArray(todayFundTransfers) && todayFundTransfers.length > 0,
    attendance: Array.isArray(todayWorkerAttendance) && todayWorkerAttendance.length > 0,
    transportation: Array.isArray(todayTransportation) && todayTransportation.length > 0,
    materials: Array.isArray(todayMaterialPurchases) && todayMaterialPurchases.length > 0,
    workerTransfers: Array.isArray(todayWorkerTransfers) && todayWorkerTransfers.length > 0,
    miscExpenses: Array.isArray(todayMiscExpenses) && todayMiscExpenses.length > 0
  };

  const totalDataSections = Object.keys(dataIndicators).length;
  const sectionsWithData = Object.values(dataIndicators).filter(Boolean).length;

  return (
    <div className="p-4 slide-in">

      <ProjectSelector
        selectedProjectId={selectedProjectId}
        onProjectChange={(projectId, projectName) => selectProject(projectId, projectName)}
      />

      {/* Data Overview Indicator */}
      {selectedProjectId && (
        <Card className={`mb-3 border-l-4 ${
          sectionsWithData === 0 
            ? 'border-l-amber-400 bg-amber-50/30' 
            : sectionsWithData === totalDataSections 
              ? 'border-l-green-500 bg-green-50/30' 
              : 'border-l-blue-500 bg-blue-50/30'
        }`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${
                  sectionsWithData === 0 
                    ? 'bg-amber-400' 
                    : sectionsWithData === totalDataSections 
                      ? 'bg-green-500' 
                      : 'bg-blue-500'
                }`}></div>
                <span className="text-sm font-medium">
                  بيانات يوم {formatDate(selectedDate)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-lg arabic-numbers">{sectionsWithData}</span>
                  <span className="text-muted-foreground">/{totalDataSections}</span>
                </div>
                {sectionsWithData === 0 && (
                  <span className="text-amber-700 bg-amber-100 px-3 py-1 rounded-full text-xs font-medium">
                    لا توجد بيانات
                  </span>
                )}
                {sectionsWithData > 0 && sectionsWithData < totalDataSections && (
                  <span className="text-blue-700 bg-blue-100 px-3 py-1 rounded-full text-xs font-medium">
                    بيانات جزئية
                  </span>
                )}
                {sectionsWithData === totalDataSections && (
                  <span className="text-green-700 bg-green-100 px-3 py-1 rounded-full text-xs font-medium">
                    بيانات كاملة ✓
                  </span>
                )}
              </div>
            </div>
            {sectionsWithData > 0 && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {dataIndicators.fundTransfers && (
                  <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded">عهدة</span>
                )}
                {dataIndicators.attendance && (
                  <span className="bg-success/10 text-success text-xs px-2 py-1 rounded">حضور</span>
                )}
                {dataIndicators.transportation && (
                  <span className="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded">نقل</span>
                )}
                {dataIndicators.materials && (
                  <span className="bg-green-500/10 text-green-600 text-xs px-2 py-1 rounded">مواد</span>
                )}
                {dataIndicators.workerTransfers && (
                  <span className="bg-orange-500/10 text-orange-600 text-xs px-2 py-1 rounded">حوالات</span>
                )}
                {dataIndicators.miscExpenses && (
                  <span className="bg-purple-500/10 text-purple-600 text-xs px-2 py-1 rounded">متنوعة</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Date and Balance Info */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Label className="block text-sm font-medium text-foreground mb-1">التاريخ</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-foreground mb-1">المبلغ المتبقي السابق</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={carriedForward}
                onChange={(e) => setCarriedForward(e.target.value)}
                placeholder="0"
                className="text-center arabic-numbers"
              />
            </div>
          </div>

          {/* Fund Transfer Section */}
          <div className="border-t pt-3">
            <h4 className="font-medium text-foreground mb-2">تحويل عهدة جديدة</h4>
            {dailyExpensesError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">
                  خطأ في جلب البيانات: {dailyExpensesError.message}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-2">
              <Input
                type="number"
                inputMode="decimal"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                placeholder="المبلغ *"
                className="text-center"
                min="0"
                step="0.01"
              />
              <AutocompleteInput
                value={senderName}
                onChange={setSenderName}
                category="senderNames"
                placeholder="اسم المرسل"
              />
            </div>
            <AutocompleteInput
              type="number"
              inputMode="numeric"
              value={transferNumber}
              onChange={setTransferNumber}
              category="transferNumbers"
              placeholder="رقم الحولة"
              className="w-full mb-2 arabic-numbers"
            />
            <div className="flex gap-2">
              <AutocompleteInput
                value={transferType}
                onChange={setTransferType}
                category="transferTypes"
                placeholder="نوع التحويل *"
                className="flex-1"
              />
              <Button 
                onClick={handleAddFundTransfer} 
                size="sm" 
                className="bg-primary"
                disabled={addFundTransferMutation.isPending || updateFundTransferMutation.isPending}
                data-testid="button-add-fund-transfer"
              >
                {addFundTransferMutation.isPending || updateFundTransferMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : editingFundTransferId ? (
                  <Save className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
              {editingFundTransferId && (
                <Button onClick={resetFundTransferForm} size="sm" variant="outline">
                  إلغاء
                </Button>
              )}
            </div>

            {/* عرض العهد المضافة لهذا اليوم */}
            <div className="mt-3 pt-3 border-t">
              <h5 className="text-sm font-medium text-muted-foreground mb-2">العهد المضافة اليوم:</h5>

              {dailyExpensesLoading ? (
                <div className="text-center text-muted-foreground">جاري التحميل...</div>
              ) : Array.isArray(todayFundTransfers) && todayFundTransfers.length > 0 ? (
                <div className="space-y-2">
                  {safeFundTransfers.map((transfer, index) => (
                    <div key={transfer.id || index} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div className="text-sm flex-1">
                        <div>{transfer.senderName || 'غير محدد'}</div>
                        <div className="text-xs text-muted-foreground">{transfer.transferType}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium arabic-numbers">{formatCurrency(transfer.amount)}</span>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleEditFundTransfer(transfer)}
                            data-testid="button-edit-fund-transfer"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteFundTransferMutation.mutate(transfer.id)}
                            disabled={deleteFundTransferMutation.isPending}
                            data-testid="button-delete-fund-transfer"
                          >
                            {deleteFundTransferMutation.isPending ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="text-left pt-2 border-t">
                    <span className="text-sm text-muted-foreground">إجمالي العهد: </span>
                    <span className="font-bold text-primary arabic-numbers">
                      {formatCurrency(totals.totalFundTransfers)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <DollarSign className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">
                    لا توجد تحويلات عهد للتاريخ {selectedDate}
                  </p>
                  <p className="text-xs text-gray-500">
                    يمكنك إضافة تحويل جديد أو اختيار تاريخ آخر
                  </p>

                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Worker Wages */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center">
            <Users className="text-primary ml-2 h-5 w-5" />
            أجور العمال
          </h4>
          {safeAttendance.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Users className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">لا يوجد حضور عمال للتاريخ {selectedDate}</p>
              <p className="text-xs text-gray-500 mt-1">اذهب إلى صفحة حضور العمال لتسجيل الحضور</p>
            </div>
          ) : (
            <div className="space-y-2">
              {safeAttendance.map((attendance, index) => {
                const worker = workers.find(w => w.id === attendance.workerId);
                return (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm">{worker?.name || `عامل ${index + 1}`}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium arabic-numbers">{formatCurrency(attendance.paidAmount)}</span>
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              // توجيه إلى صفحة حضور العمال مع معرف العامل والتاريخ للتعديل
                              setLocation(`/worker-attendance?edit=${attendance.id}&worker=${attendance.workerId}&date=${selectedDate}`);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteWorkerAttendanceMutation.mutate(attendance.id)}
                            disabled={deleteWorkerAttendanceMutation.isPending}
                            data-testid="button-delete-worker-attendance"
                          >
                            {deleteWorkerAttendanceMutation.isPending ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                );
              })}
              <div className="text-left mt-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">إجمالي أجور العمال: </span>
                <span className="font-bold text-primary arabic-numbers">
                  {formatCurrency(totals.totalWorkerWages)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transportation */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center">
            <Car className="text-secondary ml-2 h-5 w-5" />
            أجور المواصلات
          </h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <AutocompleteInput
                value={transportDescription}
                onChange={setTransportDescription}
                category="transportDescriptions"
                placeholder="الوصف"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={transportAmount}
                onChange={(e) => setTransportAmount(e.target.value)}
                placeholder="المبلغ"
                className="text-center arabic-numbers"
              />
            </div>
            <div className="flex gap-2">
              <AutocompleteInput
                value={transportNotes}
                onChange={setTransportNotes}
                category="notes"
                placeholder="ملاحظات"
                className="flex-1"
              />
              <Button 
                onClick={handleAddTransportation} 
                size="sm" 
                className="bg-secondary"
                disabled={addTransportationMutation.isPending || updateTransportationMutation.isPending}
                data-testid="button-add-transportation"
              >
                {addTransportationMutation.isPending || updateTransportationMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border border-white border-t-transparent" />
                ) : (
                  editingTransportationId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />
                )}
              </Button>
              {editingTransportationId && (
                <Button onClick={resetTransportationForm} size="sm" variant="outline">
                  إلغاء
                </Button>
              )}
            </div>

            {/* Show existing transportation expenses */}
            {safeTransportation.length === 0 ? (
              <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mt-3">
                <Car className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">لا توجد مصاريف نقل للتاريخ {selectedDate}</p>
                <p className="text-xs text-gray-500 mt-1">أضف مصاريف جديدة أو اختر تاريخ آخر</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {safeTransportation.map((expense, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-sm flex-1">{expense.description}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium arabic-numbers">{formatCurrency(expense.amount)}</span>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleEditTransportation(expense)}
                          data-testid="button-edit-transportation"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteTransportationMutation.mutate(expense.id)}
                          disabled={deleteTransportationMutation.isPending}
                          data-testid="button-delete-transportation"
                        >
                          {deleteTransportationMutation.isPending ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-left mt-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">إجمالي النقل: </span>
                  <span className="font-bold text-secondary arabic-numbers">
                    {formatCurrency(totals.totalTransportation)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Materials */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center">
            <Package className="text-success ml-2 h-5 w-5" />
            شراء مواد
          </h4>
          {!Array.isArray(todayMaterialPurchases) || todayMaterialPurchases.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <Package className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">لا توجد مشتريات مواد للتاريخ {selectedDate}</p>
              <p className="text-xs text-gray-500 mt-1">اذهب إلى شراء المواد لإضافة مشتريات جديدة</p>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {safeMaterialPurchases.map((purchase, index) => {
                // إستخدام البيانات المحفوظة مباشرة في الجدول أولاً
                const materialName = purchase.materialName || purchase.material?.name || 'مادة غير محددة';
                const materialUnit = purchase.materialUnit || purchase.unit || purchase.material?.unit || 'وحدة';
                const materialCategory = purchase.materialCategory || purchase.material?.category;
                
                return (
                <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                  <div className="text-sm flex-1">
                    <div className="font-medium">{materialName}</div>
                    <div className="text-xs text-muted-foreground">
                      {purchase.quantity} {materialUnit} × {formatCurrency(purchase.unitPrice)}
                    </div>
                    {purchase.supplierName && (
                      <div className="text-xs text-muted-foreground">المورد: {purchase.supplierName}</div>
                    )}
                    {purchase.purchaseType && (
                      <div className={`text-xs font-medium ${purchase.purchaseType === 'آجل' ? 'text-orange-600' : 'text-green-600'}`}>
                        {purchase.purchaseType === 'آجل' ? '⏰ آجل' : '💵 نقد'}
                      </div>
                    )}
                    {materialCategory && (
                      <div className="text-xs text-muted-foreground">الفئة: {materialCategory}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium arabic-numbers ${purchase.purchaseType === 'آجل' ? 'text-orange-600' : 'text-green-600'}`}>
                      {formatCurrency(purchase.totalAmount)}
                    </span>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          // توجيه إلى صفحة شراء المواد مع معرف الشراء للتعديل
                          setLocation(`/material-purchase?edit=${purchase.id}`);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteMaterialPurchaseMutation.mutate(purchase.id)}
                        disabled={deleteMaterialPurchaseMutation.isPending}
                        data-testid="button-delete-material-purchase"
                      >
                        {deleteMaterialPurchaseMutation.isPending ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
              <div className="text-left mt-2 pt-2 border-t space-y-1">
                <div>
                  <span className="text-sm text-muted-foreground">المشتريات النقدية (تؤثر على الرصيد): </span>
                  <span className="font-bold text-success arabic-numbers">
                    {formatCurrency(totals.totalMaterialCosts)}
                  </span>
                </div>
                {(() => {
                  const deferredAmount = Array.isArray(todayMaterialPurchases) ? 
                    todayMaterialPurchases
                      .filter(purchase => purchase.purchaseType === "آجل")
                      .reduce((sum, purchase) => sum + parseFloat(purchase.totalAmount || "0"), 0) : 0;
                  return deferredAmount > 0 ? (
                    <div>
                      <span className="text-sm text-muted-foreground">المشتريات الآجلة (لا تؤثر على الرصيد): </span>
                      <span className="font-bold text-orange-600 arabic-numbers">
                        {formatCurrency(deferredAmount)}
                      </span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => setLocation("/material-purchase")}
            className="w-full border-2 border-dashed"
          >
            <Plus className="ml-2 h-4 w-4" />
            إضافة شراء مواد
          </Button>
        </CardContent>
      </Card>

      {/* Worker Transfers */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <h4 className="font-medium text-foreground mb-3 flex items-center">
            <DollarSign className="text-warning ml-2 h-5 w-5" />
            حولة من حساب العمال
          </h4>
          {!Array.isArray(todayWorkerTransfers) || todayWorkerTransfers.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <ArrowLeftRight className="mx-auto h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">لا توجد حوالات عمال للتاريخ {selectedDate}</p>
              <p className="text-xs text-gray-500 mt-1">اذهب إلى صفحة العمال لإدارة الحوالات</p>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {safeWorkerTransfers.map((transfer, index) => {
                const worker = workers.find(w => w.id === transfer.workerId);
                return (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted rounded border-r-4 border-warning">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {worker?.name || 'عامل غير معروف'}
                        </span>
                        <span className="font-bold text-warning arabic-numbers">{formatCurrency(transfer.amount)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span>المستلم: {transfer.recipientName}</span>
                        {transfer.recipientPhone && (
                          <span className="mr-3">الهاتف: {transfer.recipientPhone}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        طريقة التحويل: {transfer.transferMethod === "hawaleh" ? "حولة" : transfer.transferMethod === "bank" ? "تحويل بنكي" : "نقداً"}
                      </div>
                    </div>
                    <div className="flex gap-1 mr-2">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          // توجيه إلى صفحة حسابات العمال مع معرف التحويل للتعديل
                          setLocation(`/worker-accounts?edit=${transfer.id}&worker=${transfer.workerId}`);
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          // نقل التأكيد خارج mutationFn لإصلاح مشكلة onSuccess
                          const isConfirmed = window.confirm('هل أنت متأكد من حذف حوالة العامل؟ هذا الإجراء لا يمكن التراجع عنه.');
                          if (isConfirmed) {
                            deleteWorkerTransferMutation.mutate(transfer.id);
                          }
                        }}
                        disabled={deleteWorkerTransferMutation.isPending}
                        data-testid="button-delete-worker-transfer"
                      >
                        {deleteWorkerTransferMutation.isPending ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="text-left mt-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">إجمالي الحوالات: </span>
                <span className="font-bold text-warning arabic-numbers">
                  {formatCurrency(totals.totalWorkerTransfers)}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => setLocation("/worker-accounts")}
            className="w-full border-2 border-dashed"
          >
            <Plus className="ml-2 h-4 w-4" />
            إرسال حولة جديدة
          </Button>
        </CardContent>
      </Card>

      {/* Worker Miscellaneous Expenses */}
      {selectedProjectId && (
        <WorkerMiscExpenses 
          projectId={selectedProjectId} 
          selectedDate={selectedDate} 
        />
      )}

      {/* Project Fund Transfers Section */}
      <Card className="bg-background border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-foreground">ترحيل الأموال بين المشاريع</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProjectTransfers(!showProjectTransfers)}
              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            >
              {showProjectTransfers ? (
                <>
                  <ChevronUp className="h-4 w-4 ml-1" />
                  إخفاء
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 ml-1" />
                  إظهار
                </>
              )}
            </Button>
          </div>

          {showProjectTransfers && (
            <div className="space-y-3">
              {safeProjectTransfers.map((transfer) => (
                <div 
                  key={transfer.id} 
                  className={`p-3 rounded border-r-4 ${
                    transfer.toProjectId === selectedProjectId 
                      ? 'bg-green-50 border-green-500' 
                      : 'bg-red-50 border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {transfer.toProjectId === selectedProjectId ? (
                            <span className="text-green-700">أموال واردة من: {transfer.fromProjectName}</span>
                          ) : (
                            <span className="text-red-700">أموال صادرة إلى: {transfer.toProjectName}</span>
                          )}
                        </span>
                        <span className={`font-bold arabic-numbers ${
                          transfer.toProjectId === selectedProjectId ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transfer.toProjectId === selectedProjectId ? '+' : '-'}{formatCurrency(transfer.amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div>السبب: {transfer.transferReason || 'ترحيل أموال'}</div>
                        {transfer.description && (
                          <div className="mt-1">الوصف: {transfer.description}</div>
                        )}
                        <div className="mt-1">التاريخ: {formatDate(transfer.transferDate)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => setLocation("/project-transfers")}
              className="w-full border-2 border-dashed border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <ArrowLeftRight className="ml-2 h-4 w-4" />
              إدارة عمليات ترحيل الأموال
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Total Summary */}
      <ExpenseSummary
        totalIncome={totals.totalIncome}
        totalExpenses={totals.totalExpenses}
        remainingBalance={totals.remainingBalance}
      />

      {/* Save Button */}
      <div className="mt-4">
        <Button
          onClick={handleSaveSummary}
          disabled={saveDailySummaryMutation.isPending}
          className="w-full bg-success hover:bg-success/90 text-success-foreground"
        >
          <Save className="ml-2 h-4 w-4" />
          {saveDailySummaryMutation.isPending ? "جاري الحفظ..." : "حفظ المصروفات"}
        </Button>
      </div>
    </div>
  );
}

// Export default مع Error Boundary
export default function DailyExpenses() {
  return (
    <ErrorBoundary>
      <DailyExpensesContent />
    </ErrorBoundary>
  );
}