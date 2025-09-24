
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, Shield, Mail, User, UserPlus, Code } from "lucide-react";

// مخططات التحقق
const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح").min(1, "البريد الإلكتروني مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "الاسم الأول يجب أن يكون حرفين على الأقل"),
  lastName: z.string().optional(),
  email: z.string().email("بريد إلكتروني غير صالح").min(1, "البريد الإلكتروني مطلوب"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

const verifyEmailSchema = z.object({
  userId: z.string().min(1, "معرف المستخدم مطلوب"),
  token: z.string().min(1, "رمز التحقق مطلوب"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

export default function Landing() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'verify'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<'custom' | 'replit'>('custom');

  // نماذج التحقق
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });

  const verifyEmailForm = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { userId: "", token: "" },
  });

  // طفرة تسجيل الدخول المخصص
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await fetch('/api/custom-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: (data) => {
      if (data.success && data.tokens) {
        localStorage.setItem('customAuthToken', data.tokens.accessToken);
        localStorage.setItem('customRefreshToken', data.tokens.refreshToken);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        toast({ title: "تم تسجيل الدخول بنجاح", description: `مرحباً ${data.user.firstName}!` });
        navigate("/");
      } else if (data.requireEmailVerification) {
        setActiveTab('verify');
        toast({ 
          title: "تفعيل البريد الإلكتروني مطلوب", 
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({ 
        title: "فشل تسجيل الدخول", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // طفرة التسجيل
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await fetch('/api/custom-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "تم إنشاء الحساب بنجاح", description: data.message });
        setActiveTab('verify');
        if (data.user) {
          verifyEmailForm.setValue('userId', data.user.id);
        }
      }
    },
    onError: (error) => {
      toast({ 
        title: "فشل إنشاء الحساب", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // طفرة التحقق من البريد الإلكتروني
  const verifyEmailMutation = useMutation({
    mutationFn: async (data: VerifyEmailFormData) => {
      const response = await fetch('/api/custom-auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      return result;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "تم تفعيل البريد الإلكتروني", description: data.message });
        setActiveTab('login');
      }
    },
    onError: (error) => {
      toast({ 
        title: "فشل التحقق", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const onVerifyEmailSubmit = (data: VerifyEmailFormData) => {
    verifyEmailMutation.mutate(data);
  };

  const handleReplitAuth = () => {
    window.location.href = '/api/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        
        {/* شعار التطبيق */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 rounded-full p-3">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">لوحة إدارة التطبيقات</h1>
          <p className="text-gray-600 mt-2">نظام إدارة شامل للتطبيقات والخوادم</p>
        </div>

        {/* اختيار طريقة المصادقة */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex gap-2 mb-4">
            <Button
              variant={authMethod === 'custom' ? 'default' : 'outline'}
              onClick={() => setAuthMethod('custom')}
              className="flex-1"
            >
              نظام مخصص
            </Button>
            <Button
              variant={authMethod === 'replit' ? 'default' : 'outline'}
              onClick={() => setAuthMethod('replit')}
              className="flex-1"
            >
              Replit Auth
            </Button>
          </div>
        </div>

        {/* واجهة النظام المخصص */}
        {authMethod === 'custom' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">تسجيل الدخول</CardTitle>
              <CardDescription className="text-center">
                اختر العملية المطلوبة من الأسفل
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="login" className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    دخول
                  </TabsTrigger>
                  <TabsTrigger value="register" className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    تسجيل
                  </TabsTrigger>
                  <TabsTrigger value="verify" className="flex items-center gap-2">
                    <Code className="w-4 h-4" />
                    تفعيل
                  </TabsTrigger>
                </TabsList>

                {/* تسجيل الدخول */}
                <TabsContent value="login" className="space-y-4">
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>البريد الإلكتروني</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                                <Input {...field} type="email" placeholder="admin@example.com" className="pr-10" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>كلمة المرور</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  placeholder="كلمة المرور"
                                  className="pl-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                                >
                                  {showPassword ? <EyeOff /> : <Eye />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جارِ تسجيل الدخول...
                          </>
                        ) : (
                          'تسجيل الدخول'
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                {/* التسجيل */}
                <TabsContent value="register" className="space-y-4">
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الاسم الأول</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="أحمد" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>الاسم الأخير</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="محمد" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={registerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>البريد الإلكتروني</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                                <Input {...field} type="email" placeholder="ahmed@example.com" className="pr-10" />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>كلمة المرور</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showPassword ? "text" : "password"}
                                  placeholder="كلمة المرور"
                                  className="pl-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                                >
                                  {showPassword ? <EyeOff /> : <Eye />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>تأكيد كلمة المرور</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  {...field}
                                  type={showConfirmPassword ? "text" : "password"}
                                  placeholder="تأكيد كلمة المرور"
                                  className="pl-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute left-3 top-3 h-4 w-4 text-gray-400"
                                >
                                  {showConfirmPassword ? <EyeOff /> : <Eye />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جارِ إنشاء الحساب...
                          </>
                        ) : (
                          'إنشاء حساب جديد'
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>

                {/* تفعيل البريد الإلكتروني */}
                <TabsContent value="verify" className="space-y-4">
                  <div className="text-center mb-4">
                    <Code className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold">تفعيل البريد الإلكتروني</h3>
                    <p className="text-sm text-gray-600">
                      أدخل الرمز المرسل إلى بريدك الإلكتروني
                    </p>
                  </div>

                  <Form {...verifyEmailForm}>
                    <form onSubmit={verifyEmailForm.handleSubmit(onVerifyEmailSubmit)} className="space-y-4">
                      <FormField
                        control={verifyEmailForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>معرف المستخدم</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="معرف المستخدم" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={verifyEmailForm.control}
                        name="token"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>رمز التحقق</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="أدخل رمز التحقق" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" disabled={verifyEmailMutation.isPending}>
                        {verifyEmailMutation.isPending ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جارِ التحقق...
                          </>
                        ) : (
                          'تفعيل الحساب'
                        )}
                      </Button>
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* واجهة Replit Auth */}
        {authMethod === 'replit' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-center">تسجيل الدخول عبر Replit</CardTitle>
              <CardDescription className="text-center">
                استخدم حساب Replit الخاص بك لتسجيل الدخول
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Button onClick={handleReplitAuth} className="w-full">
                <Shield className="ml-2 h-4 w-4" />
                تسجيل الدخول عبر Replit
              </Button>
              
              <p className="text-center text-sm text-gray-500 mt-4">
                سيتم تحويلك إلى صفحة مصادقة Replit
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2025 لوحة إدارة التطبيقات</p>
        </div>
      </div>
    </div>
  );
}
