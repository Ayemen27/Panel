
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, LogIn, UserPlus, Server, ArrowRight, Shield, Globe, Activity } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Schema للتسجيل
const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

// Schema للتسجيل الجديد
const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // نموذج تسجيل الدخول
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // نموذج التسجيل
  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      role: "user",
    },
  });

  // طلب تسجيل الدخول
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "فشل في تسجيل الدخول");
      }
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: `أهلاً بك ${user.firstName || user.username}`,
      });
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // طلب التسجيل
  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      const { confirmPassword, ...dataToSend } = userData;
      const res = await apiRequest("POST", "/api/register", dataToSend);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "فشل في إنشاء الحساب");
      }
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: `أهلاً بك ${user.firstName || user.username}`,
      });
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "خطأ في إنشاء الحساب",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onLogin = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* خلفية متحركة */}
      <div className="absolute inset-0 bg-grid-white/10 bg-grid-16 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-pink-500/20 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000" />
      </div>

      <div className="relative w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* الجانب الأيسر - معلومات النظام */}
        <div className="text-center lg:text-right order-2 lg:order-1 text-white">
          <div className="mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl mb-6 shadow-2xl">
              <Server className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent leading-tight">
              لوحة إدارة Nginx
            </h1>
            <p className="text-xl lg:text-2xl text-blue-100 mb-8 leading-relaxed">
              نظام إدارة شامل للخوادم والتطبيقات مع أمان متقدم
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
                <Globe className="w-8 h-8 text-blue-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2">إدارة النطاقات</h3>
              <p className="text-blue-200 text-sm">ربط وإدارة النطاقات بسهولة</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
                <Shield className="w-8 h-8 text-green-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2">أمان SSL</h3>
              <p className="text-blue-200 text-sm">شهادات مجانية وتجديد تلقائي</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
                <Activity className="w-8 h-8 text-purple-300" />
              </div>
              <h3 className="text-lg font-semibold mb-2">مراقبة مباشرة</h3>
              <p className="text-blue-200 text-sm">إحصائيات وتنبيهات فورية</p>
            </div>
          </div>

          <div className="space-y-4 text-blue-100">
            <div className="flex items-center justify-center lg:justify-end gap-3">
              <span className="text-lg">إدارة التطبيقات والعمليات</span>
              <ArrowRight className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-center justify-center lg:justify-end gap-3">
              <span className="text-lg">تكوين Nginx المتقدم</span>
              <ArrowRight className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-center justify-center lg:justify-end gap-3">
              <span className="text-lg">واجهة عربية احترافية</span>
              <ArrowRight className="w-5 h-5 text-blue-400" />
            </div>
          </div>
        </div>

        {/* الجانب الأيمن - نماذج تسجيل الدخول */}
        <div className="w-full max-w-md mx-auto order-1 lg:order-2">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-white/10 backdrop-blur-sm border-white/20">
              <TabsTrigger value="login" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <LogIn className="w-4 h-4" />
                تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-slate-900">
                <UserPlus className="w-4 h-4" />
                حساب جديد
              </TabsTrigger>
            </TabsList>

            {/* تسجيل الدخول */}
            <TabsContent value="login">
              <Card className="shadow-2xl border-0 bg-white/10 backdrop-blur-md border border-white/20">
                <CardHeader className="text-center text-white">
                  <CardTitle className="text-3xl font-bold">مرحباً بعودتك</CardTitle>
                  <CardDescription className="text-blue-100 text-lg">
                    أدخل بياناتك للوصول إلى لوحة التحكم
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="username" className="text-white text-base font-medium">اسم المستخدم</Label>
                      <Input
                        id="username"
                        {...loginForm.register("username")}
                        placeholder="أدخل اسم المستخدم"
                        disabled={loginMutation.isPending}
                        data-testid="input-username-login"
                        className="h-14 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400"
                      />
                      {loginForm.formState.errors.username && (
                        <p className="text-red-300 text-sm">
                          {loginForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="password" className="text-white text-base font-medium">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          {...loginForm.register("password")}
                          placeholder="أدخل كلمة المرور"
                          disabled={loginMutation.isPending}
                          data-testid="input-password-login"
                          className="h-14 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400 pl-14"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-0 h-full text-blue-200 hover:text-white hover:bg-white/10"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-red-300 text-sm">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 shadow-lg"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 animate-spin border-2 border-current border-t-transparent rounded-full" />
                          جاري تسجيل الدخول...
                        </div>
                      ) : (
                        <>
                          <LogIn className="w-5 h-5 ml-2" />
                          تسجيل الدخول
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* إنشاء حساب جديد */}
            <TabsContent value="register">
              <Card className="shadow-2xl border-0 bg-white/10 backdrop-blur-md border border-white/20">
                <CardHeader className="text-center text-white">
                  <CardTitle className="text-3xl font-bold">انضم إلينا</CardTitle>
                  <CardDescription className="text-blue-100 text-lg">
                    أنشئ حسابك الجديد للبدء
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Label htmlFor="firstName" className="text-white text-base font-medium">الاسم الأول</Label>
                        <Input
                          id="firstName"
                          {...registerForm.register("firstName")}
                          placeholder="الاسم الأول"
                          disabled={registerMutation.isPending}
                          data-testid="input-firstname"
                          className="h-12 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400"
                        />
                        {registerForm.formState.errors.firstName && (
                          <p className="text-red-300 text-sm">
                            {registerForm.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="lastName" className="text-white text-base font-medium">الاسم الأخير</Label>
                        <Input
                          id="lastName"
                          {...registerForm.register("lastName")}
                          placeholder="الاسم الأخير"
                          disabled={registerMutation.isPending}
                          data-testid="input-lastname"
                          className="h-12 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400"
                        />
                        {registerForm.formState.errors.lastName && (
                          <p className="text-red-300 text-sm">
                            {registerForm.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-white text-base font-medium">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        {...registerForm.register("email")}
                        placeholder="example@domain.com"
                        disabled={registerMutation.isPending}
                        data-testid="input-email"
                        className="h-12 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-red-300 text-sm">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="username-register" className="text-white text-base font-medium">اسم المستخدم</Label>
                      <Input
                        id="username-register"
                        {...registerForm.register("username")}
                        placeholder="اسم المستخدم"
                        disabled={registerMutation.isPending}
                        data-testid="input-username-register"
                        className="h-12 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400"
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-red-300 text-sm">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="password-register" className="text-white text-base font-medium">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="password-register"
                          type={showPassword ? "text" : "password"}
                          {...registerForm.register("password")}
                          placeholder="أدخل كلمة المرور"
                          disabled={registerMutation.isPending}
                          data-testid="input-password-register"
                          className="h-12 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400 pl-14"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-0 h-full text-blue-200 hover:text-white hover:bg-white/10"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-red-300 text-sm">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="confirmPassword" className="text-white text-base font-medium">تأكيد كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          {...registerForm.register("confirmPassword")}
                          placeholder="أعد إدخال كلمة المرور"
                          disabled={registerMutation.isPending}
                          data-testid="input-confirm-password"
                          className="h-12 bg-white/10 border-white/30 text-white placeholder:text-blue-200 focus:border-blue-400 focus:ring-blue-400 pl-14"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-0 h-full text-blue-200 hover:text-white hover:bg-white/10"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-red-300 text-sm">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 border-0 shadow-lg"
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 animate-spin border-2 border-current border-t-transparent rounded-full" />
                          جاري إنشاء الحساب...
                        </div>
                      ) : (
                        <>
                          <UserPlus className="w-5 h-5 ml-2" />
                          إنشاء حساب
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
