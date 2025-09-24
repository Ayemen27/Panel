
import { toast as baseToast } from "@/hooks/use-toast"

export interface EnhancedToastOptions {
  title?: string
  message: string
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * نظام توست محسن مع انيميشن وتأثيرات بصرية
 */
export function showEnhancedToast(options: EnhancedToastOptions) {
  const {
    title,
    message,
    variant = 'default',
    duration = 5000,
    action
  } = options

  // إضافة أيقونات حسب النوع
  const getIcon = (variant: string) => {
    switch (variant) {
      case 'success':
        return '✅'
      case 'destructive':
        return '❌'
      case 'warning':
        return '⚠️'
      default:
        return '📢'
    }
  }

  const icon = getIcon(variant)
  const enhancedTitle = title ? `${icon} ${title}` : `${icon} إشعار`

  return baseToast({
    title: enhancedTitle,
    description: message,
    variant: variant as any,
    duration,
    action: action ? {
      altText: action.label,
      onClick: action.onClick,
      children: action.label
    } as any : undefined,
  })
}

/**
 * توست سريع للنجاح
 */
export function showSuccessToast(message: string, title?: string) {
  return showEnhancedToast({
    title: title || 'نجح',
    message,
    variant: 'success'
  })
}

/**
 * توست سريع للخطأ
 */
export function showErrorToast(message: string, title?: string) {
  return showEnhancedToast({
    title: title || 'خطأ',
    message,
    variant: 'destructive'
  })
}

/**
 * توست سريع للتحذير
 */
export function showWarningToast(message: string, title?: string) {
  return showEnhancedToast({
    title: title || 'تحذير',
    message,
    variant: 'warning'
  })
}

/**
 * توست سريع للمعلومات
 */
export function showInfoToast(message: string, title?: string) {
  return showEnhancedToast({
    title: title || 'معلومة',
    message,
    variant: 'default'
  })
}

/**
 * توست مع إجراء
 */
export function showActionToast(
  message: string, 
  actionLabel: string, 
  actionCallback: () => void,
  title?: string
) {
  return showEnhancedToast({
    title: title || 'إجراء مطلوب',
    message,
    variant: 'warning',
    action: {
      label: actionLabel,
      onClick: actionCallback
    }
  })
}
