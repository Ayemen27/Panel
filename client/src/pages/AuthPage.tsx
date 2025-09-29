import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn, Shield, Lock, User, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Schema لتسجيل الدخول مع تحقق محسّن
const loginSchema = z.object({
  username: z.string()
    .min(1, "اسم المستخدم مطلوب")
    .min(3, "اسم المستخدم يجب أن يكون 3 أحرف على الأقل")
    .regex(/^[a-zA-Z0-9_@.-]+$/, "اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط"),
  password: z.string()
    .min(1, "كلمة المرور مطلوبة")
    .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

type LoginData = z.infer<typeof loginSchema>;



export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { login, user, isLoading, error: authError } = useAuth(); // استخدام useAuth hook
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // تأثير تحميل الصفحة
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // تأثير فحص حالة الخادم عند تحميل المكون
  useEffect(() => {
    console.log('🔐 [AuthPage] Component mounted');

    // Check server health on component mount
    const checkServerHealth = async () => {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          cache: 'no-cache'
        });

        if (!response.ok) {
          console.warn('🔐 [AuthPage] Server health check failed:', response.status);
          toast({
            variant: "destructive",
            title: "خطأ في الاتصال",
            description: `الخادم غير متاح (${response.status}). يرجى التحقق من حالة الاتصال.`,
            duration: 5000,
          });
        } else {
          console.log('🔐 [AuthPage] Server health check passed');
        }
      } catch (error) {
        console.error('🔐 [AuthPage] Server health check error:', error);
        toast({
          variant: "destructive",
          title: "خطأ في الاتصال",
          description: 'لا يمكن الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت.',
          duration: 5000,
        });
      }
    };

    checkServerHealth();
  }, [toast]);


  // نموذج تسجيل الدخول
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "binarjoinanalytic", // القيمة الافتراضية لسهولة الاختبار
      password: "",
    },
  });

  const onLogin = async (data: LoginData) => {
    try {
      await login(data.username, data.password);
    } catch (error) {
      // الخطأ سيتم التعامل معه في useAuth hook
      console.error('Login failed:', error);
    }
  };

  // منع العرض إذا كان المستخدم يقوم بتسجيل الدخول أو بيانات المستخدم لا تزال قيد التحميل
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="text-white text-lg font-semibold flex items-center gap-3">
          <div className="w-6 h-6 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
          {isLoading ? "جاري التحقق من المستخدم..." : "جاري تسجيل الدخول..."}
        </div>
      </div>
    );
  }

  // عرض رسالة الخطأ إذا كانت موجودة
  useEffect(() => {
    if (authError) {
      toast({
        variant: "destructive",
        title: "خطأ في المصادقة",
        description: authError,
        duration: 5000,
      });
    }
  }, [authError, toast]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 bg-[size:32px_32px] opacity-20"></div>
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-indigo-400/20 dark:bg-indigo-600/20 rounded-full blur-3xl"></div>

      <div className={`w-full max-w-md relative z-10 transition-all duration-1000 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <Card className="backdrop-blur-lg bg-white/80 dark:bg-slate-900/80 shadow-2xl border border-white/20 dark:border-slate-700/50 rounded-2xl">
          <CardHeader className="text-center pb-8 pt-8">
            {/* Logo/Brand Section */}
            <div className="relative mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto mb-4 shadow-lg">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white dark:bg-slate-900 animate-pulse"></div>
            </div>

            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-2">
              تسجيل الدخول
            </CardTitle>
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
              أدخل بياناتك للوصول إلى لوحة التحكم الإدارية
            </p>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
              {/* Username Field */}
              <div className="space-y-3">
                <Label htmlFor="username" className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  اسم المستخدم
                </Label>
                <div className="relative group">
                  <Input
                    id="username"
                    data-testid="input-username"
                    {...loginForm.register("username")}
                    placeholder="أدخل اسم المستخدم"
                    disabled={isLoading}
                    className="h-12 bg-white/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 text-slate-900 dark:text-slate-100 text-right transition-all duration-300 rounded-xl shadow-sm group-hover:shadow-md focus:shadow-lg pl-4 pr-4"
                    dir="ltr"
                    autoComplete="username"
                  />
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
                {loginForm.formState.errors.username && (
                  <p className="text-red-500 text-sm font-medium flex items-center gap-1" data-testid="error-username">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {loginForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  كلمة المرور
                </Label>
                <div className="relative group">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    {...loginForm.register("password")}
                    placeholder="أدخل كلمة المرور"
                    disabled={isLoading}
                    className="h-12 bg-white/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 text-slate-900 dark:text-slate-100 text-right transition-all duration-300 rounded-xl shadow-sm group-hover:shadow-md focus:shadow-lg pl-12 pr-4"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-testid="button-toggle-password"
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    )}
                  </Button>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-red-500 text-sm font-medium flex items-center gap-1" data-testid="error-password">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Login Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  data-testid="button-login"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 animate-spin border-2 border-white border-t-transparent rounded-full" />
                      <span>جاري تسجيل الدخول...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <LogIn className="w-5 h-5" />
                      <span>تسجيل الدخول</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* Security Notice */}
              <div className="pt-4 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" />
                  محمي بتشفير SSL 256-bit
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}