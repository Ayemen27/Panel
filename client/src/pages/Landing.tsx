import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Server, 
  Shield, 
  Globe, 
  Activity, 
  Terminal, 
  FileText, 
  Settings,
  ArrowRight,
  Check
} from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Server,
      title: "إدارة التطبيقات",
      description: "تشغيل وإيقاف التطبيقات بسهولة مع PM2"
    },
    {
      icon: Globe,
      title: "إدارة النطاقات",
      description: "ربط النطاقات والتحقق من DNS"
    },
    {
      icon: Shield,
      title: "شهادات SSL",
      description: "إصدار وتجديد شهادات Let's Encrypt"
    },
    {
      icon: Settings,
      title: "تكوين Nginx",
      description: "إنشاء وتعديل ملفات التكوين"
    },
    {
      icon: Activity,
      title: "مراقبة النظام",
      description: "مراقبة موارد الخادم في الوقت الفعلي"
    },
    {
      icon: FileText,
      title: "عرض السجلات",
      description: "الوصول لسجلات النظام والتطبيقات"
    },
    {
      icon: Terminal,
      title: "طرفية ويب",
      description: "تنفيذ الأوامر الأساسية بأمان"
    }
  ];

  const stats = [
    { label: "إدارة التطبيقات", value: "100%" },
    { label: "أمان SSL", value: "آمن" },
    { label: "مراقبة مباشرة", value: "24/7" },
    { label: "واجهة عربية", value: "كاملة" }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              <Server className="w-4 h-4 ml-2" />
              لوحة تحكم احترافية
            </Badge>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              إدارة خادم Nginx
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              لوحة تحكم شاملة لإدارة التطبيقات والنطاقات وشهادات SSL 
              مع واجهة عربية متجاوبة ومراقبة مباشرة للنظام
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6"
                onClick={() => window.location.href = '/api/login'}
                data-testid="button-login"
              >
                تسجيل الدخول
                <ArrowRight className="w-5 h-5 mr-2" />
              </Button>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                <span>آمن ومحمي</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
              {stats.map((stat, index) => (
                <Card key={index} className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              المميزات الرئيسية
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              كل ما تحتاجه لإدارة خادمك وتطبيقاتك في مكان واحد
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Technology Section */}
      <div className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              تقنيات حديثة وموثوقة
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              مبنية بأحدث التقنيات لضمان الأداء والأمان
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-border/50">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Server className="w-8 h-8 text-blue-500" />
                </div>
                <CardTitle>Nginx + PM2</CardTitle>
                <CardDescription>
                  خادم ويب عالي الأداء مع إدارة متقدمة للعمليات
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle>Let's Encrypt</CardTitle>
                <CardDescription>
                  شهادات SSL مجانية مع تجديد تلقائي
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-purple-500" />
                </div>
                <CardTitle>مراقبة مباشرة</CardTitle>
                <CardDescription>
                  WebSocket للتحديثات الفورية والإشعارات
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 لوحة التحكم الاحترافية. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
