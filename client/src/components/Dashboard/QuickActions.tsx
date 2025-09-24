import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Tag, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export function QuickActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const reloadNginxMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/nginx/reload");
    },
    onSuccess: () => {
      toast({
        title: "تم إعادة تحميل Nginx",
        description: "تم إعادة تحميل تكوين Nginx بنجاح",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error) => {
      toast({
        title: "خطأ في إعادة التحميل",
        description: "فشل في إعادة تحميل Nginx",
        variant: "destructive",
      });
    },
  });

  const actions = [
    {
      label: "إضافة تطبيق جديد",
      icon: Plus,
      variant: "default" as const,
      action: () => setLocation("/applications"),
      testId: "action-add-app"
    },
    {
      label: "إصدار شهادة SSL",
      icon: Tag,
      variant: "default" as const,
      className: "bg-green-600 hover:bg-green-700 text-white",
      action: () => setLocation("/ssl"),
      testId: "action-issue-ssl"
    },
    {
      label: "إعادة تحميل Nginx",
      icon: RefreshCw,
      variant: "default" as const,
      className: "bg-orange-600 hover:bg-orange-700 text-white",
      action: () => reloadNginxMutation.mutate(),
      loading: reloadNginxMutation.isPending,
      testId: "action-reload-nginx"
    },
  ];

  return (
    <Card data-testid="quick-actions">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">الإجراءات السريعة</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              className={action.className}
              onClick={action.action}
              disabled={action.loading}
              data-testid={action.testId}
            >
              {action.loading ? (
                <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <action.icon className="w-4 h-4 ml-2" />
              )}
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
