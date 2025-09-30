import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const formSchema = insertApplicationSchema.extend({
  domain: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAppModal({ open, onOpenChange }: AddAppModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [envVarsText, setEnvVarsText] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      usePm2: true,
      status: 'stopped',
      envVars: {},
    },
  });

  const usePm2 = watch("usePm2");

  const createAppMutation = useMutation({
    mutationFn: async (data: FormData) => {
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

      await apiRequest("POST", "/api/applications", appData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "تم إنشاء التطبيق",
        description: "تم إنشاء التطبيق بنجاح",
      });
      reset();
      setEnvVarsText("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "خطأ في إنشاء التطبيق",
        description: error instanceof Error ? error.message : "فشل في إنشاء التطبيق",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createAppMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setEnvVarsText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} data-testid="add-app-modal">
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-auto" aria-describedby="dialog-description">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
              إضافة تطبيق جديد
            </DialogTitle>
            <div id="dialog-description" className="sr-only">
              نموذج لإضافة تطبيق جديد إلى النظام
            </div>
          <div className="flex items-center justify-between">
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
            <Label htmlFor="domain">النطاق (اختياري)</Label>
            <Input
              id="domain"
              {...register("domain")}
              placeholder="app4.binarjoin.com"
              data-testid="input-domain"
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
              checked={usePm2 ?? true}
              onCheckedChange={(checked) => setValue("usePm2", checked ?? true)}
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
              disabled={createAppMutation.isPending}
              data-testid="button-create-app"
            >
              {createAppMutation.isPending ? "جاري الإنشاء..." : "إنشاء التطبيق"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}