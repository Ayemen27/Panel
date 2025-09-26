
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, LogIn, UserPlus, Server, ArrowRight } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* الجانب الأيسر - معلومات النظام */}
        <div className="text-center lg:text-right order-2 lg:order-1">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
              <Server className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              لوحة إدارة Nginx
            </h1>
            <p className="text-xl text-muted-foreground mb-6">
              نظام إدارة شامل للخوادم والتطبيقات
            </p>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-center lg:justify-end gap-2">
              <span>إدارة التطبيقات والنطاقات</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center justify-center lg:justify-end gap-2">
              <span>شهادات SSL التلقائية</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center justify-center lg:justify-end gap-2">
              <span>مراقبة النظام في الوقت الفعلي</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center justify-center lg:justify-end gap-2">
              <span>واجهة عربية متكاملة</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
          </div>
        </div>

        {/* الجانب الأيمن - نماذج تسجيل الدخول */}
        <div className="w-full max-w-md mx-auto order-1 lg:order-2">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                تسجيل الدخول
              </TabsTrigger>
              <TabsTrigger value="register" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                حساب جديد
              </TabsTrigger>
            </TabsList>

            {/* تسجيل الدخول */}
            <TabsContent value="login">
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
                  <CardDescription>
                    أدخل بياناتك للوصول إلى لوحة التحكم
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">اسم المستخدم</Label>
                      <Input
                        id="username"
                        {...loginForm.register("username")}
                        placeholder="أدخل اسم المستخدم"
                        disabled={loginMutation.isPending}
                        data-testid="input-username-login"
                        className="h-12"
                      />
                      {loginForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          {...loginForm.register("password")}
                          placeholder="أدخل كلمة المرور"
                          disabled={loginMutation.isPending}
                          data-testid="input-password-login"
                          className="h-12 pl-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                          جاري تسجيل الدخول...
                        </div>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4 ml-2" />
                          دخول
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* إنشاء حساب جديد */}
            <TabsContent value="register">
              <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">إنشاء حساب جديد</CardTitle>
                  <CardDescription>
                    املأ البيانات لإنشاء حسابك الجديد
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">الاسم الأول</Label>
                        <Input
                          id="firstName"
                          {...registerForm.register("firstName")}
                          placeholder="الاسم الأول"
                          disabled={registerMutation.isPending}
                          data-testid="input-firstname"
                          className="h-12"
                        />
                        {registerForm.formState.errors.firstName && (
                          <p className="text-sm text-destructive">
                            {registerForm.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">الاسم الأخير</Label>
                        <Input
                          id="lastName"
                          {...registerForm.register("lastName")}
                          placeholder="الاسم الأخير"
                          disabled={registerMutation.isPending}
                          data-testid="input-lastname"
                          className="h-12"
                        />
                        {registerForm.formState.errors.lastName && (
                          <p className="text-sm text-destructive">
                            {registerForm.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        {...registerForm.register("email")}
                        placeholder="example@domain.com"
                        disabled={registerMutation.isPending}
                        data-testid="input-email"
                        className="h-12"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username-register">اسم المستخدم</Label>
                      <Input
                        id="username-register"
                        {...registerForm.register("username")}
                        placeholder="اسم المستخدم"
                        disabled={registerMutation.isPending}
                        data-testid="input-username-register"
                        className="h-12"
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password-register">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="password-register"
                          type={showPassword ? "text" : "password"}
                          {...registerForm.register("password")}
                          placeholder="أدخل كلمة المرور"
                          disabled={registerMutation.isPending}
                          data-testid="input-password-register"
                          className="h-12 pl-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          {...registerForm.register("confirmPassword")}
                          placeholder="أعد إدخال كلمة المرور"
                          disabled={registerMutation.isPending}
                          data-testid="input-confirm-password"
                          className="h-12 pl-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-2 top-0 h-full"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-destructive">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base"
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                          جاري إنشاء الحساب...
                        </div>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 ml-2" />
                          إنشاء حساب
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-back-home"
            >
              العودة للصفحة الرئيسية
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
