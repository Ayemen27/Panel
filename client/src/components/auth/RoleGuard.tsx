import { useAuth, UserRole } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
  showUnauthorizedMessage?: boolean;
}

export function RoleGuard({
  children,
  requiredRole,
  requiredRoles,
  fallback,
  showUnauthorizedMessage = true,
}: RoleGuardProps) {
  const { user, isAuthenticated, hasRole, hasAnyRole } = useAuth();

  // إذا لم يكن مسجل دخول، لا تعرض شيئاً
  if (!isAuthenticated || !user) {
    return null;
  }

  // تحديد الأدوار المطلوبة
  const roles = requiredRoles || (requiredRole ? [requiredRole] : []);

  // إذا لم تكن هناك أدوار محددة، اعرض المحتوى
  if (roles.length === 0) {
    return <>{children}</>;
  }

  // فحص الصلاحيات
  const hasRequiredPermission = requiredRole ? hasRole(requiredRole) : hasAnyRole(roles);

  if (!hasRequiredPermission) {
    // إذا كان هناك fallback، اعرضه
    if (fallback) {
      return <>{fallback}</>;
    }

    // إذا كان showUnauthorizedMessage = false، لا تعرض شيئاً
    if (!showUnauthorizedMessage) {
      return null;
    }

    // اعرض رسالة عدم وجود صلاحية
    return (
      <Alert className="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          ليس لديك صلاحية للوصول إلى هذا المحتوى. مطلوب دور: {roles.join(' أو ')}
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}

// مكوّن سريع للـ Admin فقط
export function AdminOnly({ children, fallback, showUnauthorizedMessage = true }: Omit<RoleGuardProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <RoleGuard 
      requiredRole="admin" 
      fallback={fallback}
      showUnauthorizedMessage={showUnauthorizedMessage}
    >
      {children}
    </RoleGuard>
  );
}

// مكوّن سريع للمديرين والمشرفين
export function ModeratorAndAbove({ children, fallback, showUnauthorizedMessage = true }: Omit<RoleGuardProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <RoleGuard 
      requiredRole="moderator" 
      fallback={fallback}
      showUnauthorizedMessage={showUnauthorizedMessage}
    >
      {children}
    </RoleGuard>
  );
}

// مكوّن سريع للمستخدمين العاديين وما فوق
export function UserAndAbove({ children, fallback, showUnauthorizedMessage = true }: Omit<RoleGuardProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <RoleGuard 
      requiredRole="user" 
      fallback={fallback}
      showUnauthorizedMessage={showUnauthorizedMessage}
    >
      {children}
    </RoleGuard>
  );
}