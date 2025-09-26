
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, LogIn, UserPlus, Server, Shield, Globe, Zap, Stars, Lock } from "lucide-react";
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
      queryClient.setQueryData(["/api/user"], user);
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
      queryClient.setQueryData(["/api/user"], user);
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
    <div className="min-h-screen bg-background gradient-bg flex items-center justify-center p-3 sm:p-4 lg:p-6 relative overflow-hidden">
      {/* خلفية متحركة وتأثيرات بصرية - مخفية على الهواتف الصغيرة */}
      <div className="absolute inset-0 hidden sm:block">
        {/* الكريات المتحركة - أحجام أصغر على الشاشات الصغيرة */}
        <div className="absolute top-5 sm:top-10 left-5 sm:left-10 w-12 sm:w-20 h-12 sm:h-20 bg-primary/20 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-20 sm:top-40 right-10 sm:right-20 w-16 sm:w-32 h-16 sm:h-32 bg-accent/30 rounded-full opacity-15 animate-bounce"></div>
        <div className="absolute bottom-10 sm:bottom-20 left-1/4 w-12 sm:w-24 h-12 sm:h-24 bg-primary/25 rounded-full opacity-25 animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 sm:bottom-40 right-1/3 w-8 sm:w-16 h-8 sm:h-16 bg-accent/20 rounded-full opacity-20 animate-bounce delay-500"></div>
        
        {/* النجوم */}
        <div className="absolute top-10 sm:top-20 right-1/4 text-foreground opacity-30 animate-pulse">
          <Stars className="w-4 sm:w-6 h-4 sm:h-6" />
        </div>
        <div className="absolute bottom-1/3 left-5 sm:left-10 text-foreground opacity-20 animate-pulse delay-2000">
          <Stars className="w-3 sm:w-4 h-3 sm:h-4" />
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md lg:max-w-lg">
        {/* شعار وعنوان النظام */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 bg-primary rounded-2xl sm:rounded-3xl mb-4 sm:mb-6 shadow-xl sm:shadow-2xl shadow-primary/30">
            <Server className="w-8 sm:w-10 h-8 sm:h-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-3 sm:mb-4 text-foreground leading-tight">
            🚀 لوحة التحكم الذكية
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground font-medium px-4">
            ✨ نظام إدارة متطور وآمن ✨
          </p>
        </div>

        {/* بطاقة تسجيل الدخول */}
        <Card className="backdrop-blur-xl bg-card/95 border-border shadow-xl sm:shadow-2xl overflow-hidden">
          {/* شريط علوي متدرج */}
          <div className="h-1.5 sm:h-2 bg-primary"></div>
          
          <CardContent className="p-4 sm:p-6 lg:p-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8 bg-muted/50 border-border h-12 sm:h-14">
                <TabsTrigger 
                  value="login" 
                  className="flex items-center gap-1 sm:gap-2 lg:gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm sm:text-base font-semibold px-2 sm:px-3"
                >
                  <LogIn className="w-4 sm:w-5 h-4 sm:h-5" />
                  <span className="hidden xs:inline sm:inline">تسجيل الدخول</span>
                  <span className="xs:hidden sm:hidden">دخول</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  className="flex items-center gap-1 sm:gap-2 lg:gap-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm sm:text-base font-semibold px-2 sm:px-3"
                >
                  <UserPlus className="w-4 sm:w-5 h-4 sm:h-5" />
                  <span className="hidden xs:inline sm:inline">حساب جديد</span>
                  <span className="xs:hidden sm:hidden">جديد</span>
                </TabsTrigger>
              </TabsList>

              {/* تسجيل الدخول */}
              <TabsContent value="login">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 bg-primary/10 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 border border-border">
                    <Lock className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">مرحباً بعودتك! 👋</h2>
                  <p className="text-sm sm:text-base text-muted-foreground px-2">أدخل بياناتك للوصول إلى النظام</p>
                </div>

                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4 sm:space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-foreground text-sm sm:text-base font-semibold flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      اسم المستخدم
                    </Label>
                    <Input
                      id="username"
                      {...loginForm.register("username")}
                      placeholder="أدخل اسم المستخدم"
                      disabled={loginMutation.isPending}
                      data-testid="input-username-login"
                      className="h-12 sm:h-14 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary text-base sm:text-lg"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-destructive text-sm font-medium">
                        {loginForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground text-sm sm:text-base font-semibold flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      كلمة المرور
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        {...loginForm.register("password")}
                        placeholder="أدخل كلمة المرور"
                        disabled={loginMutation.isPending}
                        data-testid="input-password-login"
                        className="h-12 sm:h-14 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary text-base sm:text-lg pl-12 sm:pl-14"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute left-1 sm:left-2 top-0 h-full w-10 sm:w-12 text-muted-foreground hover:text-foreground hover:bg-muted"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 sm:w-5 h-4 sm:h-5" />
                        ) : (
                          <Eye className="w-4 sm:w-5 h-4 sm:h-5" />
                        )}
                      </Button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-destructive text-sm font-medium">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 sm:h-14 lg:h-16 text-base sm:text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-xl sm:shadow-2xl shadow-primary/30 transform hover:scale-105 transition-all duration-200 touch-manipulation"
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-5 sm:w-6 h-5 sm:h-6 animate-spin border-2 sm:border-3 border-current border-t-transparent rounded-full" />
                        <span className="text-sm sm:text-base">جاري تسجيل الدخول...</span>
                      </div>
                    ) : (
                      <>
                        <Zap className="w-5 sm:w-6 h-5 sm:h-6 ml-2" />
                        <span className="text-sm sm:text-base">🚀 دخول للنظام</span>
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* إنشاء حساب جديد */}
              <TabsContent value="register">
                <div className="text-center mb-6 sm:mb-8">
                  <div className="inline-flex items-center justify-center w-12 sm:w-16 h-12 sm:h-16 bg-primary/10 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 border border-border">
                    <UserPlus className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">انضم إلينا! 🌟</h2>
                  <p className="text-sm sm:text-base text-muted-foreground px-2">أنشئ حسابك الجديد للبدء</p>
                </div>

                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-foreground text-sm font-semibold">الاسم الأول</Label>
                      <Input
                        id="firstName"
                        {...registerForm.register("firstName")}
                        placeholder="الاسم الأول"
                        disabled={registerMutation.isPending}
                        data-testid="input-firstname"
                        className="h-11 sm:h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary text-sm sm:text-base"
                      />
                      {registerForm.formState.errors.firstName && (
                        <p className="text-destructive text-sm">
                          {registerForm.formState.errors.firstName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-foreground text-sm font-semibold">الاسم الأخير</Label>
                      <Input
                        id="lastName"
                        {...registerForm.register("lastName")}
                        placeholder="الاسم الأخير"
                        disabled={registerMutation.isPending}
                        data-testid="input-lastname"
                        className="h-11 sm:h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary text-sm sm:text-base"
                      />
                      {registerForm.formState.errors.lastName && (
                        <p className="text-destructive text-sm">
                          {registerForm.formState.errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground text-sm font-semibold">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      {...registerForm.register("email")}
                      placeholder="example@domain.com"
                      disabled={registerMutation.isPending}
                      data-testid="input-email"
                      className="h-11 sm:h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary text-sm sm:text-base"
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-destructive text-sm">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username-register" className="text-foreground text-sm font-semibold">اسم المستخدم</Label>
                    <Input
                      id="username-register"
                      {...registerForm.register("username")}
                      placeholder="اسم المستخدم"
                      disabled={registerMutation.isPending}
                      data-testid="input-username-register"
                      className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                    {registerForm.formState.errors.username && (
                      <p className="text-destructive text-sm">
                        {registerForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password-register" className="text-foreground text-sm font-semibold">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="password-register"
                          type={showPassword ? "text" : "password"}
                          {...registerForm.register("password")}
                          placeholder="كلمة المرور"
                          disabled={registerMutation.isPending}
                          data-testid="input-password-register"
                          className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary pl-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-1 top-0 h-full w-10 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                        <p className="text-destructive text-sm">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-foreground text-sm font-semibold">تأكيد كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          {...registerForm.register("confirmPassword")}
                          placeholder="تأكيد كلمة المرور"
                          disabled={registerMutation.isPending}
                          data-testid="input-confirm-password"
                          className="h-12 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary pl-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute left-1 top-0 h-full w-10 text-muted-foreground hover:text-foreground hover:bg-muted"
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
                        <p className="text-destructive text-sm">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 sm:h-14 lg:h-16 text-base sm:text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-xl sm:shadow-2xl shadow-primary/30 transform hover:scale-105 transition-all duration-200 touch-manipulation"
                    disabled={registerMutation.isPending}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? (
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-5 sm:w-6 h-5 sm:h-6 animate-spin border-2 sm:border-3 border-current border-t-transparent rounded-full" />
                        <span className="text-sm sm:text-base">جاري إنشاء الحساب...</span>
                      </div>
                    ) : (
                      <>
                        <Stars className="w-5 sm:w-6 h-5 sm:h-6 ml-2" />
                        <span className="text-sm sm:text-base">🌟 إنشاء حساب جديد</span>
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* نص أسفل الصفحة */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-muted-foreground text-xs sm:text-sm px-4">
            © 2025 - نظام إدارة ذكي وآمن 🔐
          </p>
        </div>
      </div>
    </div>
  );
}
