import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, Save, Plus, Camera, Package, ChartGantt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSelectedProject } from "@/hooks/use-selected-project";
import ProjectSelector from "@/components/project-selector";
import { getCurrentDate, formatCurrency } from "@/lib/utils";
import { AutocompleteInput } from "@/components/ui/autocomplete-input-database";
import { apiRequest } from "@/lib/queryClient";
import { useFloatingButton } from "@/components/layout/floating-button-context";
import type { Material, InsertMaterialPurchase, InsertMaterial, Supplier, InsertSupplier } from "@shared/schema";

export default function MaterialPurchase() {
  const [, setLocation] = useLocation();
  const { selectedProjectId, selectProject } = useSelectedProject();
  
  // Get URL parameters for editing
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  
  // Form states
  const [materialName, setMaterialName] = useState<string>("");
  const [materialCategory, setMaterialCategory] = useState<string>("");
  const [materialUnit, setMaterialUnit] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [paymentType, setPaymentType] = useState<string>("نقد");
  const [supplierName, setSupplierName] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(getCurrentDate());
  const [purchaseDate, setPurchaseDate] = useState<string>(getCurrentDate());
  const [notes, setNotes] = useState<string>("");
  const [invoicePhoto, setInvoicePhoto] = useState<string>("");
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  
  // حالات نموذج إضافة المورد
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [supplierFormName, setSupplierFormName] = useState("");
  const [supplierFormContactPerson, setSupplierFormContactPerson] = useState("");
  const [supplierFormPhone, setSupplierFormPhone] = useState("");
  const [supplierFormAddress, setSupplierFormAddress] = useState("");
  const [supplierFormPaymentTerms, setSupplierFormPaymentTerms] = useState("نقد");
  const [supplierFormNotes, setSupplierFormNotes] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setFloatingAction } = useFloatingButton();

  // إجراء الحفظ لاستخدامه مع الزر العائم
  const handleFloatingSave = () => {
    if (!selectedProjectId) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار مشروع أولاً",
        variant: "destructive",
      });
      return;
    }
    // محاكاة كليك زر الحفظ
    (document.querySelector('[type="submit"]') as HTMLElement)?.click();
  };

  // تعيين إجراء الزر العائم
  useEffect(() => {
    setFloatingAction(handleFloatingSave, "حفظ المشتريات");
    return () => setFloatingAction(null);
  }, [setFloatingAction, selectedProjectId]);

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

  // دالة إعادة تعيين نموذج المورد
  const resetSupplierForm = () => {
    setSupplierFormName("");
    setSupplierFormContactPerson("");
    setSupplierFormPhone("");
    setSupplierFormAddress("");
    setSupplierFormPaymentTerms("نقد");
    setSupplierFormNotes("");
  };

  // إضافة مورد جديد
  const addSupplierMutation = useMutation({
    mutationFn: async (data: InsertSupplier) => {
      // حفظ القيم في autocomplete_data قبل العملية الأساسية
      await Promise.all([
        saveAutocompleteValue('supplier_name', supplierFormName),
        saveAutocompleteValue('supplier_contact_person', supplierFormContactPerson),
        saveAutocompleteValue('supplier_phone', supplierFormPhone),
        saveAutocompleteValue('supplier_address', supplierFormAddress),
        saveAutocompleteValue('supplier_payment_terms', supplierFormPaymentTerms)
      ]);

      return apiRequest("/api/suppliers", "POST", data);
    },
    onSuccess: (newSupplier) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "تم إضافة المورد بنجاح",
        description: `تم إضافة المورد "${supplierFormName}" إلى قاعدة البيانات`,
      });
      
      // تحديد المورد الجديد في قائمة الاختيار
      setSupplierName(supplierFormName);
      
      // إغلاق النموذج وإعادة تعيين القيم
      setIsSupplierDialogOpen(false);
      resetSupplierForm();
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في إضافة المورد",
        description: error?.message || "حدث خطأ أثناء إضافة المورد. يرجى المحاولة مرة أخرى.",
        variant: "destructive",
      });
    },
  });

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplierFormName.trim()) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى إدخال اسم المورد",
        variant: "destructive",
      });
      return;
    }

    const supplierData: InsertSupplier = {
      name: supplierFormName.trim(),
      contactPerson: supplierFormContactPerson.trim() || undefined,
      phone: supplierFormPhone.trim() || undefined,
      address: supplierFormAddress.trim() || undefined,
      paymentTerms: supplierFormPaymentTerms || undefined,
      notes: supplierFormNotes.trim() || undefined,
      isActive: true,
    };

    addSupplierMutation.mutate(supplierData);
  };

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/materials"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/materials", "GET");
        // معالجة الهيكل المتداخل للاستجابة
        if (response && response.data && Array.isArray(response.data)) {
          return response.data as Material[];
        }
        return Array.isArray(response) ? response as Material[] : [];
      } catch (error) {
        console.error("Error fetching materials:", error);
        return [];
      }
    },
    staleTime: 300000, // 5 دقائق
    gcTime: 600000, // 10 دقائق
  });

  // جلب بيانات الموردين من قاعدة البيانات
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/suppliers", "GET");
        // معالجة الهيكل المتداخل للاستجابة
        if (response && response.data && Array.isArray(response.data)) {
          return response.data as Supplier[];
        }
        return Array.isArray(response) ? response as Supplier[] : [];
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        return [];
      }
    },
    staleTime: 300000, // 5 دقائق
    gcTime: 600000, // 10 دقائق
  });

  // Fetch purchase data for editing
  const { data: purchaseToEdit, isLoading: isLoadingEdit } = useQuery({
    queryKey: ["/api/material-purchases", editId],
    queryFn: async () => {
      if (!editId) return null;
      
      try {
        console.log(`🔄 جلب بيانات المشترية للتعديل: ${editId}`);
        const response = await apiRequest(`/api/material-purchases/${editId}`, "GET");
        
        console.log('📊 استجابة جلب بيانات التعديل:', response);
        
        // معالجة الهيكل المتداخل للاستجابة
        let purchaseData = null;
        if (response && response.data) {
          purchaseData = response.data;
        } else if (response && response.id) {
          purchaseData = response;
        } else {
          console.warn('⚠️ لا توجد بيانات في الاستجابة');
          return null;
        }
        
        console.log('✅ تم جلب بيانات المشترية للتعديل:', purchaseData);
        return purchaseData;
      } catch (error) {
        console.error("❌ خطأ في جلب بيانات المشترية للتعديل:", error);
        return null;
      }
    },
    enabled: !!editId,
    retry: 1,
    staleTime: 0, // Always fetch fresh data for editing
  });

  // Effect to populate form when editing
  useEffect(() => {
    if (purchaseToEdit && editId) {
      console.log('🔄 ملء النموذج ببيانات التعديل:', purchaseToEdit);
      
      // تشخيص مفصل لحقول المادة
      console.log('🔍 تحليل البيانات المسترجعة:', {
        purchaseToEdit: {
          materialName: purchaseToEdit.materialName,
          materialCategory: purchaseToEdit.materialCategory,
          materialUnit: purchaseToEdit.materialUnit,
          unit: purchaseToEdit.unit
        },
        material: purchaseToEdit.material ? {
          name: purchaseToEdit.material.name,
          category: purchaseToEdit.material.category,
          unit: purchaseToEdit.material.unit
        } : 'لا توجد بيانات مادة مرتبطة'
      });
      
      // استخدام البيانات المحفوظة في الجدول أولاً، ثم البيانات المرتبطة
      const materialName = purchaseToEdit.materialName || purchaseToEdit.material?.name || "";
      const materialCategory = purchaseToEdit.materialCategory || purchaseToEdit.material?.category || "";
      const materialUnit = purchaseToEdit.materialUnit || purchaseToEdit.unit || purchaseToEdit.material?.unit || "";
      
      console.log('📝 القيم النهائية التي سيتم ملؤها:', {
        materialName,
        materialCategory,
        materialUnit
      });
      
      setMaterialName(materialName);
      setMaterialCategory(materialCategory);
      setMaterialUnit(materialUnit);
      setQuantity(purchaseToEdit.quantity?.toString() || "");
      setUnitPrice(purchaseToEdit.unitPrice?.toString() || "");
      setPaymentType(purchaseToEdit.purchaseType || "نقد");
      setSupplierName(purchaseToEdit.supplierName || "");
      setInvoiceNumber(purchaseToEdit.invoiceNumber || "");
      setInvoiceDate(purchaseToEdit.invoiceDate || getCurrentDate());
      setPurchaseDate(purchaseToEdit.purchaseDate || getCurrentDate());
      setNotes(purchaseToEdit.notes || "");
      setInvoicePhoto(purchaseToEdit.invoicePhoto || "");
      setEditingPurchaseId(purchaseToEdit.id);
      
      console.log('✅ تم ملء النموذج بالبيانات:', {
        materialName,
        materialCategory,
        materialUnit,
        quantity: purchaseToEdit.quantity,
        unitPrice: purchaseToEdit.unitPrice,
        purchaseType: purchaseToEdit.purchaseType
      });
    }
  }, [purchaseToEdit, editId]);

  const addMaterialMutation = useMutation({
    mutationFn: (data: InsertMaterial) => apiRequest("/api/materials", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/materials"] });
    },
    onError: (error: any) => {
      console.error("Material creation error:", error);
      let errorMessage = "حدث خطأ أثناء إضافة المادة";
      
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Get unique material names, categories, units, and suppliers
  const materialNames = Array.isArray(materials) ? materials.map(m => m.name) : [];
  const materialCategories = Array.isArray(materials) ? Array.from(new Set(materials.map(m => m.category))) : [];
  const materialUnits = Array.isArray(materials) ? Array.from(new Set(materials.map(m => m.unit))) : [];
  
  // الموردين النشطين من قاعدة البيانات
  const activeSuppliers = Array.isArray(suppliers) ? suppliers.filter(supplier => supplier.isActive) : [];

  const addMaterialPurchaseMutation = useMutation({
    mutationFn: async (data: any) => {
      // حفظ القيم في autocomplete_data قبل العملية الأساسية
      await Promise.all([
        saveAutocompleteValue('materialNames', materialName),
        saveAutocompleteValue('materialCategories', materialCategory),
        saveAutocompleteValue('materialUnits', materialUnit),
        saveAutocompleteValue('supplierNames', supplierName),
        saveAutocompleteValue('invoiceNumbers', invoiceNumber),
        saveAutocompleteValue('notes', notes)
      ]);
      
      // تنفيذ العملية الأساسية
      return apiRequest("/api/material-purchases", "POST", data);
    },
    onSuccess: async () => {
      // تحديث كاش autocomplete للتأكد من ظهور البيانات الجديدة
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });
      
      toast({
        title: "تم الحفظ",
        description: "تم حفظ شراء المواد بنجاح",
      });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "material-purchases"] });
    },
    onError: async (error: any) => {
      // حفظ القيم في autocomplete_data حتى في حالة الخطأ
      await Promise.all([
        saveAutocompleteValue('materialNames', materialName),
        saveAutocompleteValue('materialCategories', materialCategory),
        saveAutocompleteValue('materialUnits', materialUnit),
        saveAutocompleteValue('supplierNames', supplierName),
        saveAutocompleteValue('invoiceNumbers', invoiceNumber),
        saveAutocompleteValue('notes', notes)
      ]);
      
      // تحديث كاش autocomplete
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });
      
      console.error("Material purchase error:", error);
      let errorMessage = "حدث خطأ أثناء حفظ شراء المواد";
      let errorDetails: string[] = [];
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        
        // استخدام الرسالة والتفاصيل من الخادم
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        
        // إضافة التفاصيل إذا كانت متوفرة
        if (errorData.details && Array.isArray(errorData.details)) {
          errorDetails = errorData.details;
        } else if (errorData.validationErrors && Array.isArray(errorData.validationErrors)) {
          errorDetails = errorData.validationErrors;
        }
      }
      
      // تحسين عرض الرسالة مع التفاصيل
      const fullMessage = errorDetails.length > 0 
        ? `${errorMessage}\n\n${errorDetails.map(detail => `• ${detail}`).join('\n')}`
        : errorMessage;
      
      toast({
        title: "خطأ في حفظ شراء المواد",
        description: fullMessage,
        variant: "destructive",
        duration: 8000, // وقت أطول لقراءة التفاصيل
      });
      // لا تقم بإعادة تعيين النموذج عند حدوث خطأ
    },
  });

  const resetForm = () => {
    setMaterialName("");
    setMaterialCategory("");
    setMaterialUnit("");
    setQuantity("");
    setUnitPrice("");
    setPaymentType("نقد");
    setSupplierName("");
    setInvoiceNumber("");
    setInvoiceDate(getCurrentDate());
    setPurchaseDate(getCurrentDate());
    setNotes("");
    setInvoicePhoto("");
    setEditingPurchaseId(null);
  };

  // Update Material Purchase Mutation
  const updateMaterialPurchaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      console.log('🔄 [PATCH] بدء تحديث المشترية:', { id, data });
      
      // حفظ القيم في autocomplete_data قبل العملية الأساسية
      await Promise.all([
        saveAutocompleteValue('materialNames', materialName),
        saveAutocompleteValue('materialCategories', materialCategory),
        saveAutocompleteValue('materialUnits', materialUnit),
        saveAutocompleteValue('supplierNames', supplierName),
        saveAutocompleteValue('invoiceNumbers', invoiceNumber),
        saveAutocompleteValue('notes', notes)
      ]);
      
      const response = await apiRequest(`/api/material-purchases/${id}`, "PATCH", data);
      console.log('✅ [PATCH] استجابة تحديث المشترية:', response);
      return response;
    },
    onSuccess: async () => {
      // تحديث كاش autocomplete للتأكد من ظهور البيانات الجديدة
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });
      
      toast({
        title: "تم التعديل",
        description: "تم تعديل شراء المواد بنجاح",
      });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "material-purchases"] });
    },
    onError: async (error: any) => {
      // حفظ القيم في autocomplete_data حتى في حالة الخطأ
      await Promise.all([
        saveAutocompleteValue('materialNames', materialName),
        saveAutocompleteValue('materialCategories', materialCategory),
        saveAutocompleteValue('materialUnits', materialUnit),
        saveAutocompleteValue('supplierNames', supplierName),
        saveAutocompleteValue('invoiceNumbers', invoiceNumber),
        saveAutocompleteValue('notes', notes)
      ]);
      
      // تحديث كاش autocomplete
      queryClient.invalidateQueries({ queryKey: ["/api/autocomplete"] });
      
      console.error("Material purchase update error:", error);
      let errorMessage = "حدث خطأ أثناء تحديث شراء المواد";
      let errorDetails: string[] = [];
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        
        if (errorData.details && Array.isArray(errorData.details)) {
          errorDetails = errorData.details;
        } else if (errorData.validationErrors && Array.isArray(errorData.validationErrors)) {
          errorDetails = errorData.validationErrors;
        }
      }
      
      const fullMessage = errorDetails.length > 0 
        ? `${errorMessage}\n\n${errorDetails.map(detail => `• ${detail}`).join('\n')}`
        : errorMessage;
      
      toast({
        title: "خطأ في تحديث شراء المواد",
        description: fullMessage,
        variant: "destructive",
        duration: 8000,
      });
      // لا تقم بإعادة تعيين النموذج عند حدوث خطأ
    }
  });

  // Delete Material Purchase Mutation
  const deleteMaterialPurchaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/material-purchases/${id}`, "DELETE"),
    onSuccess: () => {
      toast({
        title: "تم الحذف",
        description: "تم حذف شراء المواد بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "material-purchases"] });
    },
    onError: (error: any) => {
      console.error("Material purchase delete error:", error);
      let errorMessage = "حدث خطأ أثناء حذف شراء المواد";
      let errorDetails: string[] = [];
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        
        if (errorData.details && Array.isArray(errorData.details)) {
          errorDetails = errorData.details;
        }
      }
      
      const fullMessage = errorDetails.length > 0 
        ? `${errorMessage}\n\n${errorDetails.map(detail => `• ${detail}`).join('\n')}`
        : errorMessage;
      
      toast({
        title: "خطأ في حذف شراء المواد",
        description: fullMessage,
        variant: "destructive",
        duration: 6000,
      });
    }
  });

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return (qty * price).toFixed(2);
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setInvoicePhoto(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSave = (saveAndAddAnother = false) => {
    if (!selectedProjectId || !materialName || !materialUnit || !quantity || !unitPrice) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع البيانات المطلوبة",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = parseFloat(calculateTotal());
    const purchaseData = {
      projectId: selectedProjectId,
      materialName: materialName.trim(),
      materialCategory: materialCategory.trim() || null, // تأكد من حفظ null بدلاً من سلسلة فارغة
      materialUnit: materialUnit.trim(),
      quantity: parseFloat(quantity),
      unitPrice: parseFloat(unitPrice),
      totalAmount: totalAmount,
      purchaseType: paymentType.trim(), // تنظيف وتنسيق نوع الدفع - استخدام purchaseType
      supplierName: supplierName?.trim() || '',
      invoiceNumber: invoiceNumber?.trim() || '',
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      invoicePhoto: invoicePhoto || '',
      notes: notes?.trim() || '',
      purchaseDate: purchaseDate,
    };

    console.log('💾 بيانات المشترية قبل الحفظ:', {
      materialName: purchaseData.materialName,
      materialCategory: purchaseData.materialCategory,
      materialUnit: purchaseData.materialUnit,
      isEditing: !!editingPurchaseId
    });

    if (editingPurchaseId) {
      updateMaterialPurchaseMutation.mutate({
        id: editingPurchaseId,
        data: purchaseData
      });
    } else {
      addMaterialPurchaseMutation.mutate(purchaseData);
    }

    if (!saveAndAddAnother && !editingPurchaseId) {
      setLocation("/daily-expenses");
    }
  };

  // Fetch Material Purchases for Edit Support (filtered by purchase date)
  const { data: allMaterialPurchases = [], isLoading: materialPurchasesLoading, refetch: refetchMaterialPurchases } = useQuery<any[]>({
    queryKey: ["/api/projects", selectedProjectId, "material-purchases"],
    enabled: !!selectedProjectId,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Always fetch fresh data
  });

  // Filter purchases by selected purchase date
  const materialPurchases = allMaterialPurchases.filter((purchase: any) => {
    if (!purchase.purchaseDate) return false;
    const purchaseDateTime = new Date(purchase.purchaseDate);
    const selectedDateTime = new Date(purchaseDate);
    return purchaseDateTime.toDateString() === selectedDateTime.toDateString();
  });

  // Auto-refresh when page loads or purchase date changes
  useEffect(() => {
    if (selectedProjectId) {
      refetchMaterialPurchases();
    }
  }, [selectedProjectId, purchaseDate, refetchMaterialPurchases]);

  // Edit Function
  const handleEdit = (purchase: any) => {
    setMaterialName(purchase.materialName || purchase.material?.name || "");
    setMaterialCategory(purchase.materialCategory || purchase.material?.category || "");
    setMaterialUnit(purchase.materialUnit || purchase.material?.unit || purchase.unit || "");
    setQuantity(purchase.quantity);
    setUnitPrice(purchase.unitPrice);
    setPaymentType(purchase.purchaseType || purchase.paymentType || "نقد");
    setSupplierName(purchase.supplierName || "");
    setInvoiceNumber(purchase.invoiceNumber || "");
    setInvoiceDate(purchase.invoiceDate || getCurrentDate());
    setPurchaseDate(purchase.purchaseDate || getCurrentDate());
    setNotes(purchase.notes || "");
    setInvoicePhoto(purchase.invoicePhoto || "");
    setEditingPurchaseId(purchase.id);
  };



  return (
    <div className="p-4 slide-in">
      {/* مؤشر التحميل لبيانات التعديل */}
      {isLoadingEdit && editId && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-center space-x-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-blue-700">جاري تحميل بيانات المشترية للتعديل...</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center">
            <ChartGantt className="ml-2 h-5 w-5 text-primary" />
            {editingPurchaseId ? "تعديل مشترية المواد" : "اختر المشروع"}
          </h2>
          <ProjectSelector
            selectedProjectId={selectedProjectId}
            onProjectChange={(projectId, projectName) => selectProject(projectId, projectName)}
            showHeader={false}
            variant="compact"
          />
        </CardContent>
      </Card>

      {/* Purchase Form */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Material Name */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">اسم المادة</Label>
              <AutocompleteInput
                value={materialName}
                onChange={setMaterialName}
                category="materialNames"
                placeholder="اختر أو أدخل اسم المادة..."
              />
            </div>

            {/* Material Category */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">فئة المادة</Label>
              <AutocompleteInput
                value={materialCategory}
                onChange={setMaterialCategory}
                category="materialCategories"
                placeholder="اختر أو أدخل فئة المادة..."
              />
            </div>

            {/* Material Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">الكمية</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="text-center arabic-numbers"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">الوحدة</Label>
                <AutocompleteInput
                  value={materialUnit}
                  onChange={setMaterialUnit}
                  category="materialUnits"
                  placeholder="طن، كيس، م³..."
                />
              </div>
            </div>

            {/* Price and Total */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">سعر الوحدة</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                  className="text-center arabic-numbers"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">المبلغ الإجمالي</Label>
                <Input
                  type="number"
                  value={calculateTotal()}
                  readOnly
                  className="text-center arabic-numbers bg-muted"
                />
              </div>
            </div>

            {/* Payment Type */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">نوع الدفع</Label>
              <RadioGroup value={paymentType} onValueChange={setPaymentType} className="flex gap-4">
                <div className="flex items-center space-x-reverse space-x-2">
                  <RadioGroupItem value="نقد" id="cash" />
                  <Label htmlFor="cash" className="text-sm">نقد</Label>
                </div>
                <div className="flex items-center space-x-reverse space-x-2">
                  <RadioGroupItem value="آجل" id="credit" />
                  <Label htmlFor="credit" className="text-sm">آجل</Label>
                </div>
                <div className="flex items-center space-x-reverse space-x-2">
                  <RadioGroupItem value="توريد" id="supply" />
                  <Label htmlFor="supply" className="text-sm">توريد</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Supplier/Store */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">اسم المورد/المحل</Label>
              <div className="flex gap-2">
                <Select value={supplierName} onValueChange={setSupplierName}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="اختر المورد..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSuppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.name}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{supplier.name}</span>
                          {supplier.contactPerson && (
                            <span className="text-xs text-muted-foreground">
                              جهة الاتصال: {supplier.contactPerson}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {activeSuppliers.length === 0 && (
                      <SelectItem value="no-suppliers" disabled>
                        <span className="text-muted-foreground">لا توجد موردين مسجلين</span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="إضافة مورد جديد"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إضافة مورد جديد</DialogTitle>
                      <DialogDescription>
                        أدخل معلومات المورد الجديد. جميع الحقول اختيارية عدا اسم المورد.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddSupplier} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="supplier-name">اسم المورد/المحل *</Label>
                        <Input
                          id="supplier-name"
                          value={supplierFormName}
                          onChange={(e) => setSupplierFormName(e.target.value)}
                          placeholder="مثال: مؤسسة الخضراء للمواد"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="supplier-contact">الشخص المسؤول</Label>
                        <Input
                          id="supplier-contact"
                          value={supplierFormContactPerson}
                          onChange={(e) => setSupplierFormContactPerson(e.target.value)}
                          placeholder="مثال: أحمد محمد"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="supplier-phone">رقم الهاتف</Label>
                        <Input
                          id="supplier-phone"
                          value={supplierFormPhone}
                          onChange={(e) => setSupplierFormPhone(e.target.value)}
                          placeholder="مثال: 777123456"
                          type="tel"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="supplier-address">العنوان</Label>
                        <Input
                          id="supplier-address"
                          value={supplierFormAddress}
                          onChange={(e) => setSupplierFormAddress(e.target.value)}
                          placeholder="مثال: شارع الستين، صنعاء"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="supplier-payment">شروط الدفع</Label>
                        <Select value={supplierFormPaymentTerms} onValueChange={setSupplierFormPaymentTerms}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر شروط الدفع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="نقد">نقد</SelectItem>
                            <SelectItem value="أجل">أجل</SelectItem>
                            <SelectItem value="نقد وأجل">نقد وأجل</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="supplier-notes">ملاحظات</Label>
                        <Textarea
                          id="supplier-notes"
                          value={supplierFormNotes}
                          onChange={(e) => setSupplierFormNotes(e.target.value)}
                          placeholder="أي ملاحظات إضافية..."
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-2 space-x-reverse pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsSupplierDialogOpen(false);
                            resetSupplierForm();
                          }}
                        >
                          إلغاء
                        </Button>
                        <Button
                          type="submit"
                          disabled={addSupplierMutation.isPending || !supplierFormName.trim()}
                        >
                          {addSupplierMutation.isPending ? "جاري الإضافة..." : "إضافة المورد"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              {activeSuppliers.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  لا توجد موردين مسجلين. اضغط + لإضافة مورد جديد
                </p>
              )}
            </div>

            {/* Purchase Date */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">تاريخ الشراء</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">رقم الفاتورة</Label>
                <AutocompleteInput
                  type="number"
                  inputMode="numeric"
                  value={invoiceNumber}
                  onChange={setInvoiceNumber}
                  category="invoiceNumbers"
                  placeholder="رقم الفاتورة"
                  className="arabic-numbers"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-foreground mb-2">تاريخ الفاتورة</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Invoice Photo Upload */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">صورة الفاتورة</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                {invoicePhoto ? (
                  <div className="space-y-2">
                    <img 
                      src={invoicePhoto} 
                      alt="Invoice" 
                      className="max-w-full max-h-32 mx-auto rounded"
                    />
                    <p className="text-sm text-success">تم رفع الصورة بنجاح</p>
                  </div>
                ) : (
                  <>
                    <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-2">اضغط لإضافة صورة الفاتورة</p>
                  </>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="invoice-photo"
                />
                <Label
                  htmlFor="invoice-photo"
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg cursor-pointer hover:bg-primary/90 transition-colors inline-block"
                >
                  {invoicePhoto ? "تغيير الصورة" : "اختر صورة"}
                </Label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="block text-sm font-medium text-foreground mb-2">ملاحظات</Label>
              <AutocompleteInput
                value={notes}
                onChange={setNotes}
                category="notes"
                placeholder="أي ملاحظات إضافية..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={() => handleSave(false)}
          disabled={addMaterialPurchaseMutation.isPending || updateMaterialPurchaseMutation.isPending}
          className="w-full bg-success hover:bg-success/90 text-success-foreground"
        >
          <Save className="ml-2 h-4 w-4" />
          {(addMaterialPurchaseMutation.isPending || updateMaterialPurchaseMutation.isPending) 
            ? "جاري الحفظ..." 
            : editingPurchaseId 
              ? "تحديث الشراء" 
              : "حفظ الشراء"}
        </Button>
        
        {!editingPurchaseId && (
          <Button
            onClick={() => handleSave(true)}
            disabled={addMaterialPurchaseMutation.isPending}
            variant="outline"
            className="w-full"
          >
            <Plus className="ml-2 h-4 w-4" />
            حفظ وإضافة آخر
          </Button>
        )}

        {editingPurchaseId && (
          <Button
            onClick={resetForm}
            variant="outline"
            className="w-full"
          >
            إلغاء التحرير
          </Button>
        )}
      </div>

      {/* Material Purchases List for Today */}
      {materialPurchasesLoading && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">جاري تحميل المشتريات...</div>
          </CardContent>
        </Card>
      )}

      {/* No purchases message for selected date */}
      {selectedProjectId && allMaterialPurchases.length > 0 && materialPurchases.length === 0 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">لا توجد مشتريات في {new Date(purchaseDate).toLocaleDateString('en-GB')}</h3>
              <p className="text-sm">غيّر تاريخ الشراء أعلاه لعرض مشتريات تواريخ أخرى</p>
              <p className="text-sm mt-1">إجمالي المشتريات المسجلة: {allMaterialPurchases.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedProjectId && materialPurchases && materialPurchases.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                المشتريات في {new Date(purchaseDate).toLocaleDateString('en-GB')} ({materialPurchases.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                غيّر تاريخ الشراء أعلاه لعرض مشتريات تواريخ أخرى
              </p>
            </div>
            <div className="space-y-3">
              {materialPurchases.map((purchase: any) => (
                <div key={purchase.id} className="border rounded-lg p-3 bg-card">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-foreground">
                          {purchase.materialName || purchase.material?.name || "غير محدد"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({purchase.materialUnit || purchase.material?.unit || purchase.unit || "غير محدد"})
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {(purchase.materialCategory || purchase.material?.category) && (
                          <p>الفئة: {purchase.materialCategory || purchase.material?.category}</p>
                        )}
                        <p>الكمية: {purchase.quantity} | السعر: {formatCurrency(purchase.unitPrice)}</p>
                        <p className="font-medium">الإجمالي: {formatCurrency(purchase.totalAmount)}</p>
                        {purchase.supplierName && <p>المورد: {purchase.supplierName}</p>}
                        {purchase.purchaseType && <p>نوع الدفع: {purchase.purchaseType}</p>}
                        {purchase.purchaseDate && (
                          <p>تاريخ الشراء: {new Date(purchase.purchaseDate).toLocaleDateString('en-GB')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(purchase)}
                        disabled={editingPurchaseId === purchase.id}
                      >
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMaterialPurchaseMutation.mutate(purchase.id)}
                        disabled={deleteMaterialPurchaseMutation.isPending}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
