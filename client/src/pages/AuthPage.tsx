
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, LogIn, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // نموذج تسجيل الدخول
  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "binarjoinanalytic", // القيمة الافتراضية لسهولة الاختبار
      password: "",
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

  const onLogin = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-border">
          <CardHeader className="text-center pb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-xl mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              تسجيل الدخول
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-2">
              أدخل بياناتك للوصول إلى لوحة التحكم
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">
                  اسم المستخدم أو البريد الإلكتروني
                </Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  {...loginForm.register("username")}
                  placeholder="أدخل اسم المستخدم أو البريد الإلكتروني"
                  disabled={loginMutation.isPending}
                  className="h-11 bg-background border-border text-foreground text-right"
                  dir="ltr"
                />
                {loginForm.formState.errors.username && (
                  <p className="text-destructive text-sm" data-testid="error-username">
                    {loginForm.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  كلمة المرور
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    {...loginForm.register("password")}
                    placeholder="أدخل كلمة المرور"
                    disabled={loginMutation.isPending}
                    className="h-11 bg-background border-border text-foreground pl-10 text-right"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-testid="button-toggle-password"
                    className="absolute left-0 top-0 h-11 w-11 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-destructive text-sm" data-testid="error-password">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                data-testid="button-login"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                    جاري تسجيل الدخول...
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 ml-2" />
                    تسجيل الدخول
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
