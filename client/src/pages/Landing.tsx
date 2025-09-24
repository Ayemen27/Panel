
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";


export default function Landing() {
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

        {/* واجهة Replit Auth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">تسجيل الدخول عبر Replit</CardTitle>
            <CardDescription className="text-center">
              استخدم حساب Replit الخاص بك لتسجيل الدخول
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Button data-testid="button-replit-login" onClick={handleReplitAuth} className="w-full">
              <Shield className="ml-2 h-4 w-4" />
              تسجيل الدخول عبر Replit
            </Button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              سيتم تحويلك إلى صفحة مصادقة Replit
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2025 لوحة إدارة التطبيقات</p>
        </div>
      </div>
    </div>
  );
}
