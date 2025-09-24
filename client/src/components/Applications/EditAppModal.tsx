
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertApplicationSchema } from "@shared/schema";
import { z } from "zod";
import { X } from "lucide-react";
import type { Application } from "@shared/schema";

const formSchema = insertApplicationSchema.extend({
  domain: z.string().optional(),
}).partial();

type FormData = z.infer<typeof formSchema>;

interface EditAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null;
}

export function EditAppModal({ open, onOpenChange, applicationId }: EditAppModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [envVarsText, setEnvVarsText] = useState("");

  const { data: applications } = useQuery({
    queryKey: ["/api/applications"],
    enabled: !!applicationId && open,
  });

  const application = applications?.find((app: any) => app.id === applicationId);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const usePm2 = watch("usePm2");

  useEffect(() => {
    if (application) {
      // Populate form with current application data
      setValue("name", application.name);
      setValue("port", application.port);
      setValue("path", application.path);
      setValue("command", application.command);
      setValue("description", application.description || "");
      setValue("usePm2", application.usePm2);
      
      // Convert env vars object to text
      if (application.envVars && typeof application.envVars === 'object') {
        const envText = Object.entries(application.envVars)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        setEnvVarsText(envText);
      }
    }
  }, [application, setValue]);

  const updateAppMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!applicationId) return;
      
      // Parse environment variables
      let envVars = {};
      if (envVarsText.trim()) {
        try {
          const lines = envVarsText.split('\n').filter(line => line.trim());
          envVars = lines.reduce((acc: any, line) => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
              acc[key.trim()] = valueParts.join('=').trim();
            }
            return acc;
          }, {});
        } catch (error) {
          throw new Error("تنسيق متغيرات البيئة غير صحيح");
        }
      }

      const appData = {
        ...data,
        envVars,
      };

      await apiRequest("PUT", `/api/applications/${applicationId}`, appData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: [`/api/applications/${applicationId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "تم تحديث التطبيق",
        description: "تم تحديث التطبيق بنجاح",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "خطأ في تحديث التطبيق",
        description: error instanceof Error ? error.message : "فشل في تحديث التطبيق",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    updateAppMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setEnvVarsText("");
    onOpenChange(false);
  };

  if (!application && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            <span className="mr-2">جاري تحميل بيانات التطبيق...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="edit-app-modal">
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              تعديل التطبيق
            </DialogTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">اسم التطبيق *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="مثال: app4"
                data-testid="input-app-name"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1" data-testid="error-name">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="port">المنفذ *</Label>
              <Input
                id="port"
                type="number"
                {...register("port", { valueAsNumber: true })}
                placeholder="3003"
                data-testid="input-port"
              />
              {errors.port && (
                <p className="text-sm text-destructive mt-1" data-testid="error-port">
                  {errors.port.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="path">مسار الجذر *</Label>
            <Input
              id="path"
              {...register("path")}
              placeholder="/home/administrator/app4"
              data-testid="input-path"
            />
            {errors.path && (
              <p className="text-sm text-destructive mt-1" data-testid="error-path">
                {errors.path.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="command">أمر التشغيل *</Label>
            <Input
              id="command"
              {...register("command")}
              placeholder="npm start"
              data-testid="input-command"
            />
            {errors.command && (
              <p className="text-sm text-destructive mt-1" data-testid="error-command">
                {errors.command.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="description">الوصف</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="وصف التطبيق"
              data-testid="input-description"
            />
          </div>

          <div>
            <Label htmlFor="envVars">متغيرات البيئة (سطر واحد لكل متغير)</Label>
            <Textarea
              id="envVars"
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              placeholder="NODE_ENV=production&#10;PORT=3000&#10;DATABASE_URL=..."
              rows={4}
              data-testid="input-env-vars"
            />
            <p className="text-sm text-muted-foreground mt-1">
              تنسيق: KEY=VALUE (سطر واحد لكل متغير)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="usePm2"
              checked={usePm2}
              onCheckedChange={(checked) => setValue("usePm2", checked)}
              data-testid="switch-use-pm2"
            />
            <Label htmlFor="usePm2" className="text-sm">
              استخدام PM2 لإدارة العملية
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button 
              type="button" 
              variant="outline"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              إلغاء
            </Button>
            <Button 
              type="submit" 
              disabled={updateAppMutation.isPending}
              data-testid="button-update-app"
            >
              {updateAppMutation.isPending ? "جاري التحديث..." : "تحديث التطبيق"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
