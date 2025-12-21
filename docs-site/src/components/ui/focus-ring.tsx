import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface FocusRingProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  focused?: boolean
  color?: string
  size?: "sm" | "md" | "lg"
}

export const FocusRing = React.forwardRef<HTMLDivElement, FocusRingProps>(
  ({ children, focused = false, color = "rgba(168, 85, 247, 0.5)", size = "md", className, ...props }, ref) => {
    const sizeClasses = {
      sm: "inset-[-2px]",
      md: "inset-[-3px]", 
      lg: "inset-[-4px]"
    }

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {children}
        <motion.div
          className={cn(
            "absolute rounded-full border-2 pointer-events-none",
            sizeClasses[size]
          )}
          style={{ borderColor: color }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: focused ? 1 : 0,
            scale: focused ? 1 : 0.8,
          }}
          transition={{
            duration: 0.2,
            ease: "easeOut"
          }}
        />
      </div>
    )
  }
)
FocusRing.displayName = "FocusRing"
