import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: 'running' | 'stopped' | 'error' | 'starting' | 'valid' | 'expired' | 'pending' | 'failed' | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'online':
      case 'active':
      case 'valid':
        return {
          variant: 'default' as const,
          className: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
          label: status === 'running' ? 'فعّال' : 
                 status === 'valid' ? 'صالح' : 'نشط',
          dot: 'bg-green-500'
        };
      case 'stopped':
      case 'offline':
      case 'inactive':
        return {
          variant: 'secondary' as const,
          className: 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30',
          label: 'متوقف',
          dot: 'bg-gray-500'
        };
      case 'error':
      case 'failed':
      case 'expired':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
          label: status === 'error' ? 'خطأ' : 
                 status === 'expired' ? 'منتهية' : 'فشل',
          dot: 'bg-red-500'
        };
      case 'starting':
      case 'pending':
      case 'loading':
        return {
          variant: 'outline' as const,
          className: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
          label: status === 'starting' ? 'يبدأ' : 'معلق',
          dot: 'bg-yellow-500'
        };
      default:
        return {
          variant: 'outline' as const,
          className: 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30',
          label: status,
          dot: 'bg-gray-500'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium",
        config.className,
        className
      )}
      data-testid={`status-${status.toLowerCase()}`}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {config.label}
    </Badge>
  );
}
