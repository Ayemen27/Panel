
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Rate Limiting Hook
const useRateLimit = (delay: number = 1000) => {
  const [isLimited, setIsLimited] = React.useState(false);
  const lastClickRef = React.useRef<number>(0);

  const checkRateLimit = React.useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < delay) {
      setIsLimited(true);
      return false;
    }
    lastClickRef.current = now;
    setIsLimited(false);
    return true;
  }, [delay]);

  return { isLimited, checkRateLimit };
};

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform-gpu relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-blue-600 to-blue-700 text-primary-foreground hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25 active:scale-95",
        destructive: "bg-gradient-to-r from-red-600 to-red-700 text-destructive-foreground hover:from-red-700 hover:to-red-800 hover:shadow-lg hover:shadow-red-500/25 active:scale-95",
        outline: "border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-blue-300 hover:shadow-md active:scale-95",
        secondary: "bg-gradient-to-r from-gray-200 to-gray-300 text-secondary-foreground hover:from-gray-300 hover:to-gray-400 hover:shadow-md active:scale-95",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-95",
        link: "text-primary underline-offset-4 hover:underline hover:text-blue-600 active:scale-95",
        success: "bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 hover:shadow-lg hover:shadow-green-500/25 active:scale-95",
        warning: "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:shadow-lg hover:shadow-orange-500/25 active:scale-95"
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 rounded-md px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
        xs: "h-7 px-2 text-xs rounded-md"
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
  enableRateLimit?: boolean
  rateLimitDelay?: number
  ripple?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    loading = false,
    loadingText = "جاري التحميل...",
    enableRateLimit = false,
    rateLimitDelay = 1000,
    ripple = true,
    onClick,
    children,
    disabled,
    ...props 
  }, ref) => {
    const Comp = asChild ? Slot : "button"
    const { isLimited, checkRateLimit } = useRateLimit(rateLimitDelay);
    const [rippleStyle, setRippleStyle] = React.useState<React.CSSProperties>({});
    const [showRipple, setShowRipple] = React.useState(false);

    const handleClick = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return;
      
      if (enableRateLimit && !checkRateLimit()) {
        e.preventDefault();
        return;
      }

      // تأثير الـ Ripple
      if (ripple) {
        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        setRippleStyle({
          left: x - 10,
          top: y - 10,
          width: 20,
          height: 20,
        });
        setShowRipple(true);
        
        setTimeout(() => setShowRipple(false), 600);
      }

      onClick?.(e);
    }, [loading, disabled, enableRateLimit, checkRateLimit, ripple, onClick]);

    const isDisabled = disabled || loading || (enableRateLimit && isLimited);

    return (
      <motion.div
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          onClick={handleClick}
          disabled={isDisabled}
          {...props}
        >
          {/* تأثير الـ Ripple */}
          {showRipple && ripple && (
            <motion.span
              className="absolute bg-white/30 rounded-full pointer-events-none"
              style={rippleStyle}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          )}
          
          {/* محتوى الزر */}
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText}
            </>
          ) : (
            children
          )}
          
          {/* مؤشر Rate Limiting */}
          {enableRateLimit && isLimited && (
            <motion.div
              className="absolute inset-0 bg-gray-400/20 rounded-lg flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="text-xs text-gray-600">انتظر...</span>
            </motion.div>
          )}
        </Comp>
      </motion.div>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants, useRateLimit }
