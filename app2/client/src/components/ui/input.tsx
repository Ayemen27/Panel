
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// Hook لحفظ قيم النماذج في localStorage
const useFormMemory = (key: string, initialValue: string = "") => {
  const [value, setValue] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`form-memory-${key}`);
      return saved || initialValue;
    }
    return initialValue;
  });

  const updateValue = React.useCallback((newValue: string) => {
    setValue(newValue);
    if (typeof window !== "undefined") {
      if (newValue) {
        localStorage.setItem(`form-memory-${key}`, newValue);
      } else {
        localStorage.removeItem(`form-memory-${key}`);
      }
    }
  }, [key]);

  const clearMemory = React.useCallback(() => {
    setValue("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(`form-memory-${key}`);
    }
  }, [key]);

  return { value, updateValue, clearMemory };
};

// Hook للتحقق التفاعلي
const useInteractiveValidation = (
  value: string,
  fieldType?: string,
  validator?: (value: string) => { isValid: boolean; message?: string; strength?: number },
  context?: string
) => {
  const [validation, setValidation] = React.useState<{
    isValid: boolean;
    message?: string;
    strength?: number;
    isValidating?: boolean;
    suggestions?: string[];
  }>({ isValid: true });

  React.useEffect(() => {
    if (!value) {
      setValidation({ isValid: true });
      return;
    }

    // التحقق المحلي أولاً
    if (validator && !fieldType) {
      setValidation(prev => ({ ...prev, isValidating: true }));
      
      const timeoutId = setTimeout(() => {
        const result = validator(value);
        setValidation({ ...result, isValidating: false });
      }, 300);

      return () => clearTimeout(timeoutId);
    }

    // التحقق مع الخادم للحقول المدعومة
    if (fieldType && (fieldType === 'email' || fieldType === 'password')) {
      setValidation(prev => ({ ...prev, isValidating: true }));
      
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch('/api/auth/validate-field', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              field: fieldType,
              value: value,
              context: context || 'register'
            })
          });

          const result = await response.json();
          
          if (result.success) {
            setValidation({
              isValid: result.isValid,
              message: result.message,
              strength: result.strength,
              suggestions: result.suggestions,
              isValidating: false
            });
          } else {
            setValidation({
              isValid: false,
              message: 'حدث خطأ في التحقق',
              isValidating: false
            });
          }
        } catch (error) {
          console.error('خطأ في التحقق:', error);
          setValidation({
            isValid: false,
            message: 'حدث خطأ في التحقق',
            isValidating: false
          });
        }
      }, 500); // تأخير أطول قليلاً للطلبات الخادم

      return () => clearTimeout(timeoutId);
    }

  }, [value, validator, fieldType, context]);

  return validation;
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  enableMemory?: boolean;
  memoryKey?: string;
  validator?: (value: string) => { isValid: boolean; message?: string; strength?: number };
  showValidation?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
  strengthIndicator?: boolean;
  fieldType?: string;
  validationContext?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type = "text",
    enableMemory = false,
    memoryKey,
    validator,
    showValidation = true,
    leftIcon,
    rightIcon,
    loading = false,
    strengthIndicator = false,
    fieldType,
    validationContext,
    onChange,
    value: controlledValue,
    ...props 
  }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
    const { value: memoryValue, updateValue: updateMemoryValue } = useFormMemory(
      memoryKey || `input-${props.name || 'default'}`,
      typeof controlledValue === 'string' ? controlledValue : ''
    );

    const currentValue = controlledValue !== undefined ? String(controlledValue) : memoryValue;
    const validation = useInteractiveValidation(currentValue, fieldType, validator, validationContext);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      if (enableMemory && controlledValue === undefined) {
        updateMemoryValue(newValue);
      }
      
      onChange?.(e);
    }, [enableMemory, controlledValue, updateMemoryValue, onChange]);

    const togglePasswordVisibility = React.useCallback(() => {
      setShowPassword(prev => !prev);
    }, []);

    const inputType = type === 'password' ? (showPassword ? 'text' : 'password') : type;
    const hasLeftIcon = leftIcon || loading;
    const hasRightIcon = rightIcon || type === 'password' || (showValidation && validation.message);

    // حساب ألوان التحقق
    const getValidationColor = () => {
      if (validation.isValidating) return 'border-blue-300 ring-blue-100';
      if (!validation.isValid) return 'border-red-300 ring-red-100 focus:border-red-500 focus:ring-red-200';
      if (validation.isValid && currentValue) return 'border-green-300 ring-green-100 focus:border-green-500 focus:ring-green-200';
      return 'border-input focus:border-blue-500 focus:ring-blue-200';
    };

    return (
      <div className="relative w-full">
        <motion.div
          animate={{ scale: isFocused ? 1.01 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          style={{ position: "relative" }}
        >
          <input
            type={inputType}
            className={cn(
              "flex h-11 w-full rounded-xl border-2 bg-background/50 backdrop-blur-sm px-4 py-2.5 text-sm ring-offset-background transition-all duration-300",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
              "placeholder:text-muted-foreground/70",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "hover:bg-background/80",
              hasLeftIcon && "pr-11",
              hasRightIcon && "pl-11",
              getValidationColor(),
              className
            )}
            ref={ref}
            value={currentValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />

          {/* أيقونة اليسار */}
          {hasLeftIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                leftIcon
              )}
            </div>
          )}

          {/* أيقونة اليمين */}
          {hasRightIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* أيقونة إظهار/إخفاء كلمة المرور */}
              {type === 'password' && (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    background: "none",
                    border: "none",
                    padding: "4px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "var(--muted-foreground)",
                    transition: "colors 0.2s"
                  }}
                  onTap={togglePasswordVisibility}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </motion.div>
              )}

              {/* أيقونة التحقق */}
              {showValidation && currentValue && !validation.isValidating && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {validation.isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </motion.div>
              )}

              {/* أيكونة التحميل للتحقق */}
              {validation.isValidating && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}

              {/* أيقونة مخصصة */}
              {rightIcon}
            </div>
          )}
        </motion.div>

        {/* مؤشر قوة كلمة المرور */}
        {strengthIndicator && type === 'password' && currentValue && typeof validation.strength === 'number' && (
          <motion.div
            style={{ marginTop: "8px" }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex space-x-1 rtl:space-x-reverse" style={{ marginBottom: "4px" }}>
              {[1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  style={{
                    height: "4px",
                    flex: 1,
                    borderRadius: "2px",
                    transition: "all 0.3s",
                    backgroundColor: validation.strength! >= level
                      ? level <= 2
                        ? "#ef4444"
                        : level === 3
                        ? "#eab308"
                        : "#22c55e"
                      : "#e5e7eb"
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
              قوة كلمة المرور: {
                validation.strength! <= 2 ? "ضعيفة" :
                validation.strength === 3 ? "متوسطة" : "قوية"
              }
            </p>
          </motion.div>
        )}

        {/* رسالة التحقق */}
        <AnimatePresence>
          {showValidation && validation.message && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                marginTop: "8px",
                fontSize: "12px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: validation.isValid ? "#15803d" : "#dc2626",
                backgroundColor: validation.isValid ? "#f0fdf4" : "#fef2f2",
                borderColor: validation.isValid ? "#bbf7d0" : "#fecaca"
              }}
            >
              {validation.isValid ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : (
                <AlertCircle className="h-3 w-3 text-red-500" />
              )}
              {validation.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input, useFormMemory, useInteractiveValidation }
