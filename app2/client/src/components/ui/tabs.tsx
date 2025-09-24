
import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-gray-100 to-gray-50 p-1.5 text-muted-foreground shadow-inner backdrop-blur-sm border border-gray-200/50",
      "dark:from-gray-800 dark:to-gray-900 dark:border-gray-700/50",
      "transition-all duration-300 ease-in-out",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium ring-offset-background transition-all duration-300 ease-in-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "hover:bg-white/80 hover:text-foreground hover:shadow-sm hover:scale-105",
      "data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20",
      "data-[state=active]:border data-[state=active]:border-blue-200/50",
      "dark:hover:bg-gray-700/80 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:border-gray-600/50",
      "before:absolute before:inset-0 before:rounded-lg before:bg-gradient-to-r before:from-blue-500/0 before:to-purple-500/0",
      "data-[state=active]:before:from-blue-500/10 data-[state=active]:before:to-purple-500/10",
      "transform-gpu backface-visibility-hidden",
      className
    )}
    {...props}
  >
    <motion.span
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="relative z-10 flex items-center gap-2"
    >
      {children}
    </motion.span>
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> & {
    animationKey?: string;
  }
>(({ className, children, animationKey, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "min-h-[200px]", // ضمان ارتفاع أدنى لتجنب القفز
      className
    )}
    {...props}
  >
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey || props.value}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1]
        }}
        className="transform-gpu"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  </TabsPrimitive.Content>
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
