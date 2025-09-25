import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/Common/StatusBadge";
import { 
  Play, 
  Square, 
  RotateCcw, 
  FileText, 
  Edit, 
  Trash2,
  Box
} from "lucide-react";
import type { Application } from "@shared/schema";

interface ApplicationTableProps {
  applications: Application[];
  loading: boolean;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
  startLoading?: boolean;
  stopLoading?: boolean;
  restartLoading?: boolean;
  deleteLoading?: boolean;
}

export function ApplicationTable({
  applications,
  loading,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onEdit,
  startLoading = false,
  stopLoading = false,
  restartLoading = false,
  deleteLoading = false,
}: ApplicationTableProps) {
  const [deleteAppId, setDeleteAppId] = useState<string | null>(null);

  if (loading) {
    return (
      <Card data-testid="applications-table-loading">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم التطبيق</TableHead>
                  <TableHead className="text-right">النطاق</TableHead>
                  <TableHead className="text-right">المنفذ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div>
                          <Skeleton className="h-4 w-24 mb-1" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {[...Array(4)].map((_, j) => (
                          <Skeleton key={j} className="w-8 h-8 rounded" />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (applications.length === 0) {
    return (
      <Card data-testid="no-applications">
        <CardContent className="p-12 text-center">
          <Box className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">لا توجد تطبيقات</h3>
          <p className="text-muted-foreground mb-4">
            ابدأ بإضافة تطبيقك الأول لإدارته من هنا
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="applications-table">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم التطبيق</TableHead>
                  <TableHead className="text-right">المسار</TableHead>
                  <TableHead className="text-right">المنفذ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow 
                    key={app.id} 
                    className="hover:bg-accent transition-colors"
                    data-testid={`app-row-${app.id || 'unknown'}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          app.status === 'running' ? 'bg-primary/20' : 'bg-gray-500/20'
                        }`}>
                          <Box className={`w-5 h-5 ${
                            app.status === 'running' ? 'text-primary' : 'text-gray-500'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`app-name-${app.id || 'unknown'}`}>
                            {app.name}
                          </p>
                          {app.description && (
                            <p className="text-sm text-muted-foreground" data-testid={`app-description-${app.id || 'unknown'}`}>
                              {app.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono" data-testid={`app-path-${app.id || 'unknown'}`}>
                        {app.path}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono" data-testid={`app-port-${app.id || 'unknown'}`}>
                        {app.port}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge 
                        status={app.status} 
                        data-testid={`app-status-${app.id || 'unknown'}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/logs/${app.id}`, '_blank')}
                          title="عرض السجلات"
                          data-testid={`button-logs-${app.id || 'unknown'}`}
                        >
                          <FileText className="w-4 h-4 text-blue-500" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit?.(app.id)}
                          title="تعديل"
                          data-testid={`button-edit-${app.id || 'unknown'}`}
                        >
                          <Edit className="w-4 h-4 text-yellow-500" />
                        </Button>

                        {app.status === 'running' ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRestart(app.id)}
                              disabled={restartLoading}
                              title="إعادة تشغيل"
                              data-testid={`button-restart-${app.id || 'unknown'}`}
                            >
                              <RotateCcw className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onStop(app.id)}
                              disabled={stopLoading}
                              title="إيقاف"
                              data-testid={`button-stop-${app.id || 'unknown'}`}
                            >
                              <Square className="w-4 h-4 text-orange-500" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onStart(app.id)}
                            disabled={startLoading}
                            title="تشغيل"
                            data-testid={`button-start-${app.id || 'unknown'}`}
                          >
                            <Play className="w-4 h-4 text-green-500" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteAppId(app.id)}
                          disabled={deleteLoading}
                          title="حذف"
                          data-testid={`button-delete-${app.id || 'unknown'}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={deleteAppId !== null} 
        onOpenChange={() => setDeleteAppId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا التطبيق؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteAppId) {
                  onDelete(deleteAppId);
                  setDeleteAppId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
