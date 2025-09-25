import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ApplicationTable } from "@/components/Applications/ApplicationTable";
import { AddAppModal } from "@/components/Applications/AddAppModal";
import { EditAppModal } from "@/components/Applications/EditAppModal"; // Assuming EditAppModal is in the same directory
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { Application } from "@shared/schema";

export default function Applications() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "غير مخول",
        description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: applications, isLoading, error } = useQuery<Application[]>({
    queryKey: ["/api/applications"],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time status
  });

  const startAppMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/applications/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "تم التشغيل",
        description: "تم تشغيل التطبيق بنجاح",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ في التشغيل",
        description: "فشل في تشغيل التطبيق",
        variant: "destructive",
      });
    },
  });

  const stopAppMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/applications/${id}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "تم الإيقاف",
        description: "تم إيقاف التطبيق بنجاح",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ في الإيقاف",
        description: "فشل في إيقاف التطبيق",
        variant: "destructive",
      });
    },
  });

  const restartAppMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/applications/${id}/restart`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "تم إعادة التشغيل",
        description: "تم إعادة تشغيل التطبيق بنجاح",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ في إعادة التشغيل",
        description: "فشل في إعادة تشغيل التطبيق",
        variant: "destructive",
      });
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "تم حذف التطبيق",
        description: "تم حذف التطبيق بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ في حذف التطبيق",
        description: error instanceof Error ? error.message : "فشل في حذف التطبيق",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (id: string) => {
    setEditingAppId(id);
    setShowEditModal(true);
  };

  const handleCloseEditModal = (open: boolean) => {
    setShowEditModal(open);
    if (!open) {
      setEditingAppId(null);
    }
  };

  if (error && isUnauthorizedError(error as Error)) {
    return null; // The useEffect will handle the redirect
  }

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="applications-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="page-title">إدارة التطبيقات</h2>
          <p className="text-muted-foreground">إدارة جميع تطبيقاتك وخدماتك</p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          data-testid="button-add-app"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة تطبيق جديد
        </Button>
      </div>

      <ApplicationTable
        applications={applications || []}
        loading={isLoading}
        onStart={startAppMutation.mutate}
        onStop={stopAppMutation.mutate}
        onRestart={restartAppMutation.mutate}
        onDelete={deleteAppMutation.mutate}
        onEdit={handleEdit}
        startLoading={startAppMutation.isPending}
        stopLoading={stopAppMutation.isPending}
        restartLoading={restartAppMutation.isPending}
        deleteLoading={deleteAppMutation.isPending}
        data-testid="applications-table"
      />

      <AddAppModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        data-testid="add-app-modal"
      />

      <EditAppModal
        open={showEditModal}
        onOpenChange={handleCloseEditModal}
        applicationId={editingAppId}
      />
    </div>
  );
}