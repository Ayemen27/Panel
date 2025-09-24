
/**
 * صفحة استرجاع كلمة المرور المتقدمة
 * يمكن الوصول إليها من الصفحة الموحدة أو مباشرة
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Mail, 
  ArrowLeft,
  Shield,
  CheckCircle,
  Lock,
  KeyRound
} from "lucide-react";

// مخطط التحقق من البيانات
const forgotPasswordSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح").min(1, "البريد الإلكتروني مطلوب"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

// مكون الخلفية المتحركة
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-orange-400/20 to-red-600/20 rounded-full blur-3xl animate-blob"></div>
    <div className="absolute -bottom-32 -left-40 w-96 h-96 bg-gradient-to-tr from-yellow-400/20 to-orange-600/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-red-400/20 to-pink-600/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
  </div>
);

export default function ForgotPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  // طفرة استرجاع كلمة المرور
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData): Promise<ForgotPasswordResponse> => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('فشل في إرسال طلب استرجاع كلمة المرور');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setIsSuccess(true);
        toast({
          title: "تم إرسال رابط الاسترجاع",
          description: "يرجى التحقق من بريدك الإلكتروني",
        });
      } else {
        toast({
          title: "خطأ في الإرسال",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "خطأ في استرجاع كلمة المرور",
        description: "حدث خطأ أثناء المعالجة",
        variant: "destructive",
      });
      console.error('Forgot password error:', error);
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen relative overflow-hidden" dir="rtl">
        <AnimatedBackground />
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 via-white/90 to-red-50/80 backdrop-blur-sm"></div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6">
            <Card className="glass-morphism border-0 shadow-2xl backdrop-blur-xl">
              <CardHeader className="space-y-1 text-center pb-8">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur-lg opacity-75 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-green-500 to-emerald-500 rounded-full p-4">
                      <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-green-700">
                  تم الإرسال بنجاح
                </CardTitle>
                <CardDescription className="text-gray-600">
                  تم إرسال رابط استرجاع كلمة المرور إلى بريدك الإلكتروني
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <Alert className="border-green-200 bg-green-50">
                  <Mail className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    يرجى التحقق من صندوق الوارد في بريدك الإلكتروني واتباع التعليمات لإعادة تعيين كلمة المرور.
                    إذا لم تجد الرسالة، تحقق من مجلد الرسائل غير المرغوب فيها.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <Button
                    onClick={() => navigate("/login")}
                    className="w-full enhanced-button"
                  >
                    <ArrowLeft className="ml-2 h-4 w-4" />
                    العودة لتسجيل الدخول
                  </Button>

                  <Button
                    onClick={() => setIsSuccess(false)}
                    variant="outline"
                    className="w-full enhanced-outline-button"
                  >
                    إرسال مرة أخرى
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" dir="rtl">
      {/* الخلفية المتحركة */}
      <AnimatedBackground />
      
      {/* تأثير التدرج */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/80 via-white/90 to-red-50/80 backdrop-blur-sm"></div>
      
      {/* المحتوى الرئيسي */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          
          {/* العودة للصفحة الرئيسية */}
          <div className="flex items-center justify-center">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="ml-2 h-4 w-4" />
                العودة لتسجيل الدخول
              </Button>
            </Link>
          </div>

          {/* شعار الاسترجاع */}
          <div className="flex flex-col items-center space-y-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 rounded-full blur-lg opacity-75 animate-pulse"></div>
              <div className="relative bg-gradient-to-r from-orange-600 to-red-600 rounded-full p-4">
                <KeyRound className="w-12 h-12 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                استرجاع كلمة المرور
              </h1>
              <p className="text-gray-600 mt-2">سنساعدك في استرجاع حسابك</p>
            </div>
          </div>

          {/* البطاقة الرئيسية */}
          <Card className="glass-morphism border-0 shadow-2xl backdrop-blur-xl">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="flex justify-center mb-4">
                <Lock className="w-16 h-16 text-orange-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                نسيت كلمة المرور؟
              </CardTitle>
              <CardDescription className="text-gray-600">
                لا تقلق، أدخل بريدك الإلكتروني وسنرسل لك رابط لإعادة تعيين كلمة المرور
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-700 font-medium">البريد الإلكتروني</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                            <Input 
                              {...field} 
                              type="email"
                              placeholder="أدخل بريدك الإلكتروني"
                              fieldType="email"
                              validationContext="forgot-password"
                              showValidation={true}
                              className="pr-10 enhanced-input"
                              data-testid="input-forgot-email"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full enhanced-button"
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="button-forgot-password"
                    style={{
                      background: "linear-gradient(135deg, #ea580c 0%, #dc2626 100%)"
                    }}
                  >
                    {forgotPasswordMutation.isPending ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        جارِ الإرسال...
                      </>
                    ) : (
                      <>
                        <Mail className="ml-2 h-4 w-4" />
                        إرسال رابط الاسترجاع
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="text-center space-y-2 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  تذكرت كلمة المرور؟{" "}
                  <Link href="/login">
                    <span className="text-orange-600 hover:text-orange-500 font-medium cursor-pointer">
                      تسجيل الدخول
                    </span>
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* تعليمات إضافية */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3 rtl:space-x-reverse">
                <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">نصائح أمنية:</p>
                  <ul className="mt-1 space-y-1 text-blue-700">
                    <li>• سيصل الرابط خلال 5 دقائق</li>
                    <li>• الرابط صالح لمدة ساعة واحدة فقط</li>
                    <li>• تحقق من مجلد الرسائل غير المرغوبة</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 space-y-1">
            <p>© 2025 نظام إدارة المشاريع الإنشائية</p>
            <p>جميع الحقوق محفوظة</p>
          </div>
        </div>
      </div>
    </div>
  );
}
