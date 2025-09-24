import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input-database";
import { User, Clock, DollarSign, FileText, Calendar, Activity, AlertCircle, CheckCircle, Timer, Calculator, MessageSquare, Banknote, TrendingUp, Target, Users, Briefcase, Hammer, Wrench, Paintbrush, Grid3X3, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, getCurrentDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { Worker } from "@shared/schema";


interface AttendanceData {
  isPresent: boolean;
  startTime?: string;
  endTime?: string;
  workDescription?: string;
  workDays?: number;
  paidAmount?: string;
  paymentType?: string;
  // إضافة الحقول الجديدة
  hoursWorked?: number;
  overtime?: number;
  overtimeRate?: number;
  actualWage?: number;
  totalPay?: number;
  remainingAmount?: number;
  notes?: string;
}

interface EnhancedWorkerCardProps {
  worker: Worker;
  attendance: AttendanceData;
  onAttendanceChange: (attendance: AttendanceData) => void;
  selectedDate?: string;
}

export default function EnhancedWorkerCard({ 
  worker, 
  attendance, 
  onAttendanceChange,
  selectedDate = getCurrentDate()
}: EnhancedWorkerCardProps) {
  const [localAttendance, setLocalAttendance] = useState<AttendanceData>(attendance);
  const [showDetails, setShowDetails] = useState(false);
  
  // جلب إحصائيات العامل
  const { data: workerStats } = useQuery({
    queryKey: ["/api/workers", worker.id, "stats"],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/workers/${worker.id}/stats`, "GET");
        return response || { totalWorkDays: 0, totalProjects: 0, totalEarnings: 0 };
      } catch (error) {
        console.error("Error fetching worker stats:", error);
        return { totalWorkDays: 0, totalProjects: 0, totalEarnings: 0 };
      }
    },
    staleTime: 30000 // حفظ البيانات لمدة 30 ثانية
  });
  
  // فحص إذا كان العامل حاضر اليوم
  const isPresentToday = localAttendance.isPresent && selectedDate === getCurrentDate();

  // تحديث الحالة المحلية عند تغيير props
  useEffect(() => {
    setLocalAttendance(attendance);
  }, [attendance]);


  const updateAttendance = (updates: Partial<AttendanceData>) => {
    const newAttendance = { ...localAttendance, ...updates };
    setLocalAttendance(newAttendance);
    onAttendanceChange(newAttendance);
  };

  const handleAttendanceToggle = (checked: boolean | "indeterminate") => {
    const isPresent = checked === true;
    
    // إضافة تأثير بصري عند التحديد/الإلغاء
    if (isPresent) {
      // تأثير عند التحديد
      const card = document.querySelector(`[data-testid="worker-card-detailed-${worker.id}"]`) as HTMLElement;
      if (card) {
        card.classList.add('animate-bounce-subtle');
        setTimeout(() => {
          card.classList.remove('animate-bounce-subtle');
        }, 600);
      }
    } else {
      // إخفاء التفاصيل عند إلغاء تحديد الحضور
      setShowDetails(false);
    }
    
    updateAttendance({
      isPresent: isPresent,
      startTime: isPresent ? (localAttendance.startTime || "07:00") : undefined,
      endTime: isPresent ? (localAttendance.endTime || "15:00") : undefined,
      workDescription: isPresent ? localAttendance.workDescription : undefined,
      workDays: isPresent ? (localAttendance.workDays || 1.0) : undefined,
      paidAmount: isPresent ? localAttendance.paidAmount : undefined,
      paymentType: isPresent ? (localAttendance.paymentType || "partial") : undefined,
    });
  };

  // حساب ساعات العمل
  const calculateWorkingHours = () => {
    if (!localAttendance.startTime || !localAttendance.endTime) return 0;
    const start = new Date(`2000-01-01T${localAttendance.startTime}:00`);
    const end = new Date(`2000-01-01T${localAttendance.endTime}:00`);
    let diffMs = end.getTime() - start.getTime();
    
    // التعامل مع الورديات الليلية
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000; // إضافة 24 ساعة
    }
    
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0, diffHours);
  };

  // حساب الأجر الأساسي (بدون الوقت الإضافي)
  const calculateBaseWage = () => {
    const workDays = localAttendance.workDays || 1.0;
    return parseFloat(worker.dailyWage) * workDays;
  };

  // حساب أجر الوقت الإضافي
  const calculateOvertimePay = () => {
    const overtime = localAttendance.overtime || 0;
    const overtimeRate = localAttendance.overtimeRate || 0;
    return overtime * overtimeRate;
  };

  // حساب إجمالي الأجر المستحق (المعادلة الموحدة)
  const calculateTotalPay = () => {
    const baseWage = calculateBaseWage();
    const overtimePay = calculateOvertimePay();
    return Math.max(0, baseWage + overtimePay); // حماية ضد القيم السالبة
  };

  // حساب المتبقي
  const calculateRemainingAmount = () => {
    const totalPay = calculateTotalPay();
    const paidAmount = parseFloat(localAttendance.paidAmount || "0");
    return totalPay - paidAmount;
  };

  // تحديث تلقائي للحسابات عند تغيير المدخلات
  useEffect(() => {
    if (localAttendance.isPresent) {
      const calculatedTotalPay = calculateTotalPay();
      const calculatedRemainingAmount = calculateRemainingAmount();
      
      // تحديث القيم المحسوبة إذا تغيرت
      if (localAttendance.totalPay !== calculatedTotalPay || 
          localAttendance.remainingAmount !== calculatedRemainingAmount ||
          localAttendance.hoursWorked !== calculateWorkingHours()) {
        
        const updatedAttendance = {
          ...localAttendance,
          actualWage: calculateBaseWage(),
          totalPay: calculatedTotalPay,
          remainingAmount: calculatedRemainingAmount,
          hoursWorked: calculateWorkingHours()
        };
        
        setLocalAttendance(updatedAttendance);
        onAttendanceChange(updatedAttendance);
      }
    }
  }, [localAttendance.workDays, localAttendance.overtime, localAttendance.overtimeRate, 
      localAttendance.paidAmount, localAttendance.startTime, localAttendance.endTime]);

  // تنسيق التاريخ
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // دالة لاختيار الأيقونة المناسبة للمهنة
  const getProfessionIcon = (profession: string) => {
    switch (profession) {
      case "معلم":
        return <Users className="h-5 w-5" />;
      case "حداد":
        return <Hammer className="h-5 w-5" />;
      case "بلاط":
        return <Grid3X3 className="h-5 w-5" />;
      case "دهان":
        return <Paintbrush className="h-5 w-5" />;
      case "عامل":
        return <Wrench className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };
  
  // دالة لاختيار لون المهنة
  const getProfessionColor = (profession: string) => {
    switch (profession) {
      case "معلم":
        return "bg-gradient-to-br from-primary to-primary/80";
      case "حداد":
        return "bg-gradient-to-br from-orange-500 to-orange-600";
      case "بلاط":
        return "bg-gradient-to-br from-blue-500 to-blue-600";
      case "دهان":
        return "bg-gradient-to-br from-green-500 to-green-600";
      case "عامل":
        return "bg-gradient-to-br from-purple-500 to-purple-600";
      default:
        return "bg-gradient-to-br from-gray-500 to-gray-600";
    }
  };
  
  return (
    <Card className={`mb-2 shadow-sm border-r-4 w-full max-w-full overflow-hidden worker-card-enhanced ${
      isPresentToday 
        ? "border-r-green-400 bg-gradient-to-r from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10 animate-pulse-slow attended-worker-glow" 
        : "border-r-primary/20 hover:border-r-primary/40"
    }`} data-testid={`worker-card-detailed-${worker.id}`}>
      <CardContent className="p-2 sm:p-3 max-w-full overflow-hidden">
        {/* رأس البطاقة - معلومات العامل */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/30 w-full max-w-full">
          <div className="flex items-center space-x-reverse space-x-2 flex-1 min-w-0 max-w-full overflow-hidden">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md profession-icon-container ${getProfessionColor(worker.type)}`}>
              {getProfessionIcon(worker.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-reverse space-x-2 mb-1">
                <h4 className="font-bold text-lg text-foreground truncate" data-testid={`worker-name-detailed-${worker.id}`}>{worker.name}</h4>
                {worker.isActive ? (
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" data-testid={`worker-status-active-${worker.id}`} />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" data-testid={`worker-status-inactive-${worker.id}`} />
                )}
              </div>
              
              {/* معلومات مضغوطة */}
              <div className="flex items-center space-x-reverse space-x-4 text-xs text-muted-foreground">
                <span className="flex items-center space-x-reverse space-x-1">
                  <span className="font-medium">{worker.type}</span>
                </span>
                <span className="flex items-center space-x-reverse space-x-1">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-bold arabic-numbers" data-testid={`worker-daily-wage-${worker.id}`}>
                    {formatCurrency(worker.dailyWage)}
                  </span>
                </span>
                <span className="flex items-center space-x-reverse space-x-1">
                  <Activity className="h-3 w-3" />
                  <span className="arabic-numbers">
                    {workerStats?.totalWorkDays || 0} يوم
                  </span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-reverse space-x-2 flex-shrink-0">
            {localAttendance.isPresent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="px-2 py-1 h-8"
                data-testid={`toggle-details-${worker.id}`}
              >
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="text-xs mr-1">تفاصيل</span>
              </Button>
            )}
            <Label htmlFor={`present-${worker.id}`} className="text-sm font-medium text-foreground cursor-pointer">
              حاضر
            </Label>
            <Checkbox
              id={`present-${worker.id}`}
              checked={localAttendance.isPresent}
              onCheckedChange={handleAttendanceToggle}
              className="w-5 h-5"
              data-testid={`attendance-checkbox-${worker.id}`}
            />
          </div>
        </div>
        
        {/* تفاصيل الحضور */}
        {localAttendance.isPresent && showDetails && (
          <div className="space-y-2 w-full max-w-full overflow-hidden">
            {/* قسم موحد مضغوط للأوقات والدفع */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 p-2 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-full overflow-hidden">
              <div className="flex items-center space-x-reverse space-x-2 mb-2">
                <Clock className="h-4 w-4 text-slate-600" />
                <h5 className="font-medium text-slate-800 dark:text-slate-200 text-sm" data-testid={`work-time-section-${worker.id}`}>تفاصيل العمل والدفع</h5>
              </div>
              
              {/* الصف الأول: أوقات العمل - 3 حقول */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">من</Label>
                  <Input
                    type="time"
                    value={localAttendance.startTime || "07:00"}
                    onChange={(e) => updateAttendance({ startTime: e.target.value })}
                    className="text-center font-mono text-sm h-8"
                    data-testid={`start-time-input-${worker.id}`}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">إلى</Label>
                  <Input
                    type="time"
                    value={localAttendance.endTime || "15:00"}
                    onChange={(e) => updateAttendance({ endTime: e.target.value })}
                    className="text-center font-mono text-sm h-8"
                    data-testid={`end-time-input-${worker.id}`}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">أيام</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0.1"
                    max="2.0"
                    value={localAttendance.workDays || 1.0}
                    onChange={(e) => updateAttendance({ workDays: parseFloat(e.target.value) || 1.0 })}
                    className="text-center arabic-numbers text-sm h-8"
                    data-testid={`work-days-input-${worker.id}`}
                  />
                </div>
              </div>
              
              {/* الصف الثاني: ساعات ووقت إضافي - 3 حقول */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">ساعات</Label>
                  <div className="h-8 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md flex items-center justify-center">
                    <span className="font-bold text-slate-700 dark:text-slate-300 arabic-numbers text-sm" data-testid={`working-hours-display-${worker.id}`}>
                      {calculateWorkingHours().toFixed(1)}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">ساعات إضافية</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="8"
                    value={localAttendance.overtime || 0}
                    onChange={(e) => updateAttendance({ overtime: parseFloat(e.target.value) || 0 })}
                    className="text-center arabic-numbers text-sm h-8"
                    data-testid={`overtime-input-${worker.id}`}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">معدل الساعة</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={localAttendance.overtimeRate || ""}
                    onChange={(e) => updateAttendance({ overtimeRate: parseFloat(e.target.value) || 0 })}
                    className="text-center arabic-numbers text-sm h-8"
                    data-testid={`overtime-rate-input-${worker.id}`}
                  />
                </div>
              </div>
              
              {/* وصف العمل */}
              <div className="space-y-1 mb-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">وصف العمل</Label>
                <AutocompleteInput
                  value={localAttendance.workDescription || ""}
                  onChange={(value) => updateAttendance({ workDescription: value })}
                  placeholder="اكتب وصف العمل المنجز..."
                  category="workDescriptions"
                  className="w-full text-sm"
                  data-testid={`work-description-input-${worker.id}`}
                />
              </div>
              
              {/* الصف الثالث: معلومات الدفع */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-reverse space-x-2 mb-2">
                  <Banknote className="h-4 w-4 text-slate-600" />
                  <h6 className="font-medium text-slate-800 dark:text-slate-200 text-sm" data-testid={`payment-section-${worker.id}`}>معلومات الدفع</h6>
                </div>
              
                {/* الصف الأول: معلومات أساسية - 3 حقول */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">نوع الدفع</Label>
                    <Select
                      value={localAttendance.paymentType || "partial"}
                      onValueChange={(value) => updateAttendance({ paymentType: value })}
                    >
                      <SelectTrigger className="h-8 text-sm" data-testid={`payment-type-select-${worker.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">دفع كامل</SelectItem>
                        <SelectItem value="partial">دفع جزئي</SelectItem>
                        <SelectItem value="credit">على الحساب</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">الأجر الفعلي</Label>
                    <div className="h-8 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md flex items-center justify-center">
                      <span className="font-bold text-slate-700 dark:text-slate-300 arabic-numbers text-sm" data-testid={`actual-wage-display-${worker.id}`}>
                        {formatCurrency(calculateBaseWage())}
                      </span>
                    </div>
                  </div>
                  
                  {localAttendance.paymentType !== "credit" ? (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">المبلغ المدفوع</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={localAttendance.paidAmount || ""}
                        onChange={(e) => updateAttendance({ paidAmount: e.target.value })}
                        className="text-center arabic-numbers text-sm h-8"
                        data-testid={`paid-amount-input-${worker.id}`}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">المبلغ المدفوع</Label>
                      <div className="h-8 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md flex items-center justify-center">
                        <span className="text-xs text-slate-500">على الحساب</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* الصف الثاني: المبلغ المتبقي وإجمالي الدفع - 3 حقول */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">إجمالي الدفع</Label>
                    <div className="h-8 px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-md flex items-center justify-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200 arabic-numbers text-sm" data-testid={`total-pay-display-${worker.id}`}>
                        {formatCurrency(calculateTotalPay())}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">المبلغ المتبقي</Label>
                    <div className="h-8 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md flex items-center justify-center">
                      <span className={`font-bold arabic-numbers text-sm ${
                        calculateRemainingAmount() > 0 ? 'text-red-600' : calculateRemainingAmount() < 0 ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'
                      }`} data-testid={`remaining-amount-display-${worker.id}`}>
                        {formatCurrency(Math.abs(calculateRemainingAmount()))}
                        {calculateRemainingAmount() > 0 && ' (مستحق)'}
                        {calculateRemainingAmount() < 0 && ' (فائض)'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">الوقت الإضافي</Label>
                    <div className="h-8 px-2 py-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-md flex items-center justify-center">
                      <span className="font-bold text-slate-700 dark:text-slate-300 arabic-numbers text-sm">
                        {formatCurrency(calculateOvertimePay())}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">إجمالي الدفع المطلوب</Label>
                    <div className="h-8 px-2 py-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-md flex items-center justify-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200 arabic-numbers text-sm" data-testid={`total-pay-display-${worker.id}`}>
                        {formatCurrency(calculateTotalPay())}
                      </span>
                    </div>
                    
                    {/* تفصيل الحساب */}
                    <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>الأجر الأساسي ({localAttendance.workDays || 1.0} يوم):</span>
                        <span className="arabic-numbers">{formatCurrency(calculateBaseWage())}</span>
                      </div>
                      {(localAttendance.overtime && localAttendance.overtimeRate) ? (
                        <div className="flex justify-between">
                          <span>الوقت الإضافي ({localAttendance.overtime} ساعة × {localAttendance.overtimeRate}):</span>
                          <span className="arabic-numbers">{formatCurrency(calculateOvertimePay())}</span>
                        </div>
                      ) : null}
                      <div className="border-t border-slate-300 pt-1 flex justify-between font-medium">
                        <span>الإجمالي:</span>
                        <span className="arabic-numbers">{formatCurrency(calculateTotalPay())}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* قسم الملاحظات الإضافية */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-reverse space-x-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-slate-600" />
                  <h6 className="font-medium text-slate-800 dark:text-slate-200 text-sm" data-testid={`notes-section-${worker.id}`}>ملاحظات</h6>
                </div>
                <AutocompleteInput
                  value={localAttendance.notes || ""}
                  onChange={(value) => updateAttendance({ notes: value })}
                  placeholder="اكتب أي ملاحظات إضافية..."
                  category="workerNotes"
                  className="w-full text-sm"
                  data-testid={`notes-input-${worker.id}`}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}