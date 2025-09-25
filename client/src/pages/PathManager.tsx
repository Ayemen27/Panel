import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Shield,
  ShieldOff,
  FolderOpen,
  FolderX,
  Calendar,
  User,
  MoreVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import type { AllowedPath } from "@shared/schema";

// Validation schema
const pathFormSchema = z.object({
  path: z.string().min(1, "المسار مطلوب").min(2, "المسار يجب أن يكون على الأقل حرفين"),
  type: z.enum(["allowed", "blocked"], {
    required_error: "نوع المسار مطلوب",
  }),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type PathFormData = z.infer<typeof pathFormSchema>;

export default function PathManager() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "allowed" | "blocked">("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<AllowedPath | null>(null);
  const [pathToDelete, setPathToDelete] = useState<AllowedPath | null>(null);

  // Form setup
  const form = useForm<PathFormData>({
    resolver: zodResolver(pathFormSchema),
    defaultValues: {
      path: "",
      type: "allowed",
      description: "",
      isActive: true,
    },
  });

  // Fetch paths
  const { data: paths = [], isLoading, error } = useQuery<AllowedPath[]>({
    queryKey: ['/api/admin/paths', typeFilter === "all" ? undefined : typeFilter],
    queryFn: async () => {
      const queryParams = typeFilter !== "all" ? `?type=${typeFilter}` : "";
      const response = await fetch(`/api/admin/paths${queryParams}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch paths');
      }
      return response.json();
    },
  });

  // Create path mutation
  const createPathMutation = useMutation({
    mutationFn: async (data: PathFormData) => {
      const response = await apiRequest('POST', '/api/admin/paths', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/paths'] });
      toast({
        title: "تم إنشاء المسار",
        description: "تم إنشاء المسار بنجاح",
      });
      setIsCreateModalOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في إنشاء المسار",
        variant: "destructive"
      });
    }
  });

  // Update path mutation
  const updatePathMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PathFormData> }) => {
      const response = await apiRequest('PUT', `/api/admin/paths/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/paths'] });
      toast({
        title: "تم تحديث المسار",
        description: "تم تحديث المسار بنجاح",
      });
      setIsEditModalOpen(false);
      setEditingPath(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في تحديث المسار",
        variant: "destructive"
      });
    }
  });

  // Delete path mutation
  const deletePathMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/admin/paths/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/paths'] });
      toast({
        title: "تم حذف المسار",
        description: "تم حذف المسار بنجاح",
      });
      setIsDeleteDialogOpen(false);
      setPathToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في حذف المسار",
        variant: "destructive"
      });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/admin/paths/${id}`, { isActive });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/paths'] });
      toast({
        title: "تم تحديث الحالة",
        description: "تم تحديث حالة المسار بنجاح",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة المسار",
        variant: "destructive"
      });
    }
  });

  // Filter paths based on search query
  const filteredPaths = paths.filter(path => {
    const matchesSearch = searchQuery === "" || 
      path.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (path.description && path.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  // Handlers
  const handleCreatePath = (data: PathFormData) => {
    createPathMutation.mutate(data);
  };

  const handleEditPath = (path: AllowedPath) => {
    setEditingPath(path);
    form.reset({
      path: path.path,
      type: path.type,
      description: path.description || "",
      isActive: path.isActive ?? true,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePath = (data: PathFormData) => {
    if (!editingPath) return;
    updatePathMutation.mutate({ id: editingPath.id, data });
  };

  const handleDeletePath = (path: AllowedPath) => {
    setPathToDelete(path);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (pathToDelete) {
      deletePathMutation.mutate(pathToDelete.id);
    }
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive });
  };

  const getTypeIcon = (type: "allowed" | "blocked") => {
    return type === "allowed" ? (
      <Shield className="w-4 h-4 text-green-600" />
    ) : (
      <ShieldOff className="w-4 h-4 text-red-600" />
    );
  };

  const getTypeBadge = (type: "allowed" | "blocked") => {
    return (
      <Badge 
        variant={type === "allowed" ? "default" : "destructive"}
        className={cn(
          "text-xs",
          type === "allowed" ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"
        )}
      >
        {type === "allowed" ? "مسموح" : "محظور"}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-6 w-6" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="path-manager-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="page-title">
            إدارة المسارات المحمية
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة المسارات المسموحة والمحظورة في النظام
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2"
          data-testid="button-add-path"
        >
          <Plus className="w-4 h-4" />
          إضافة مسار جديد
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="البحث في المسارات والأوصاف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-type-filter">
                <SelectValue placeholder="تصفية حسب النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="allowed">مسموح فقط</SelectItem>
                <SelectItem value="blocked">محظور فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredPaths.length === 0 ? (
            <div className="text-center py-12" data-testid="no-paths-message">
              <FolderX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد مسارات</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== "all" 
                  ? "لم يتم العثور على مسارات تطابق البحث المحدد" 
                  : "ابدأ بإضافة مسار جديد لإدارة الوصول"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="paths-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المسار</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPaths.map((path) => (
                    <TableRow key={path.id} data-testid={`path-row-${path.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(path.type)}
                          <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                            {path.path}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTypeBadge(path.type)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {path.description || "لا يوجد وصف"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={path.isActive ?? false}
                          onCheckedChange={(checked) => handleToggleActive(path.id, checked)}
                          data-testid={`switch-active-${path.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {path.createdAt ? formatDate(path.createdAt.toString()) : 'غير محدد'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPath(path)}
                            data-testid={`button-edit-${path.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePath(path)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-${path.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isCreateModalOpen || isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setEditingPath(null);
          form.reset();
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="path-form-modal">
          <DialogHeader>
            <DialogTitle>
              {editingPath ? "تحديث المسار" : "إضافة مسار جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingPath 
                ? "قم بتحديث بيانات المسار المحدد" 
                : "أضف مسار جديد للنظام مع تحديد نوعه والوصف"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit(editingPath ? handleUpdatePath : handleCreatePath)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>المسار</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="/مثال/للمسار" 
                        {...field} 
                        data-testid="input-path"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع المسار</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-path-type">
                          <SelectValue placeholder="اختر نوع المسار" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="allowed">مسموح</SelectItem>
                        <SelectItem value="blocked">محظور</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوصف (اختياري)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="وصف المسار وسبب إضافته..."
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">تفعيل المسار</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        هل تريد تفعيل هذا المسار فور إنشائه؟
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                    setEditingPath(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  إلغاء
                </Button>
                <Button 
                  type="submit"
                  disabled={createPathMutation.isPending || updatePathMutation.isPending}
                  data-testid="button-submit"
                >
                  {createPathMutation.isPending || updatePathMutation.isPending 
                    ? "جاري الحفظ..." 
                    : editingPath ? "تحديث" : "إنشاء"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المسار "{pathToDelete?.path}"؟ 
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deletePathMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deletePathMutation.isPending ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}