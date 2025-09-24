
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Clock, Zap, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  progress?: number;
  duration?: number;
  startTime?: number;
}

export interface ProfessionalLoaderProps {
  isLoading: boolean;
  steps?: LoadingStep[];
  message?: string;
  progress?: number;
  showSteps?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'detailed';
  onComplete?: () => void;
  estimatedTime?: number;
  className?: string;
}

const LoadingIcon = ({ variant, size }: { variant: string; size: string }) => {
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-8 w-8';
  
  const icons = {
    default: <Loader2 className={cn(iconSize, 'animate-spin text-blue-500')} />,
    database: <Database className={cn(iconSize, 'animate-pulse text-green-500')} />,
    processing: <Zap className={cn(iconSize, 'animate-bounce text-orange-500')} />,
  };

  return icons[variant as keyof typeof icons] || icons.default;
};

const StepIndicator = ({ step, index }: { step: LoadingStep; index: number }) => {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getElapsedTime = () => {
    if (step.startTime && step.status === 'loading') {
      const elapsed = Math.floor((Date.now() - step.startTime) / 1000);
      return `${elapsed}ث`;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
        step.status === 'loading' && "bg-blue-50 border border-blue-200",
        step.status === 'completed' && "bg-green-50 border border-green-200",
        step.status === 'error' && "bg-red-50 border border-red-200",
        step.status === 'pending' && "bg-gray-50 border border-gray-200"
      )}
    >
      <div className="flex-shrink-0">
        {getStatusIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-sm font-medium truncate",
            step.status === 'loading' && "text-blue-700",
            step.status === 'completed' && "text-green-700",
            step.status === 'error' && "text-red-700",
            step.status === 'pending' && "text-gray-600"
          )}>
            {step.label}
          </p>
          {getElapsedTime() && (
            <span className="text-xs text-blue-600 font-mono">
              {getElapsedTime()}
            </span>
          )}
        </div>
        
        {step.progress !== undefined && step.status === 'loading' && (
          <motion.div
            className="mt-2 bg-gray-200 rounded-full h-1.5 overflow-hidden"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
          >
            <motion.div
              className="bg-blue-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${step.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

const ProgressRing = ({ progress, size }: { progress: number; size: number }) => {
  const circumference = 2 * Math.PI * (size / 2 - 8);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative">
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 8}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-gray-200"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 8}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-blue-500"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold text-blue-600">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
};

export const ProfessionalLoader: React.FC<ProfessionalLoaderProps> = ({
  isLoading,
  steps = [],
  message = "جاري التحميل...",
  progress,
  showSteps = false,
  size = 'md',
  variant = 'default',
  onComplete,
  estimatedTime,
  className
}) => {
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const startTimeRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    if (!isLoading) return;

    startTimeRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading]);

  React.useEffect(() => {
    if (!isLoading && elapsedTime > 0) {
      onComplete?.();
      setElapsedTime(0);
    }
  }, [isLoading, elapsedTime, onComplete]);

  if (!isLoading) return null;

  const renderMinimalLoader = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("flex items-center gap-3", className)}
    >
      <LoadingIcon variant={variant} size={size} />
      <span className="text-sm text-gray-600">{message}</span>
    </motion.div>
  );

  const renderDetailedLoader = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-md mx-auto",
        className
      )}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="flex justify-center mb-4">
          {progress !== undefined ? (
            <ProgressRing progress={progress} size={80} />
          ) : (
            <LoadingIcon variant={variant} size="lg" />
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          {message}
        </h3>
        
        <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
          <span>الوقت المنقضي: {elapsedTime}ث</span>
          {estimatedTime && (
            <span>المتوقع: {estimatedTime}ث</span>
          )}
        </div>
      </div>

      {/* Steps */}
      {showSteps && steps.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            التقدم التفصيلي:
          </h4>
          {steps.map((step, index) => (
            <StepIndicator key={step.id} step={step} index={index} />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {progress !== undefined && !showSteps && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>التقدم</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );

  if (variant === 'minimal') {
    return renderMinimalLoader();
  }

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
        >
          {renderDetailedLoader()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfessionalLoader;
