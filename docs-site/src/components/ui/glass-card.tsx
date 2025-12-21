import * as React from "react"
import { cn } from "../../lib/utils"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "muted" | "accent"
  blur?: "sm" | "md" | "lg" | "xl"
  border?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", blur = "md", border = true, ...props }, ref) => {
    const blurClasses = {
      sm: "backdrop-blur-sm",
      md: "backdrop-blur-md", 
      lg: "backdrop-blur-lg",
      xl: "backdrop-blur-xl"
    }

    const variantClasses = {
      default: "bg-white/10 dark:bg-black/20 backdrop-blur-md",
      muted: "bg-white/5 dark:bg-black/10 backdrop-blur-sm", 
      accent: "bg-primary/10 dark:bg-primary/20 backdrop-blur-md"
    }

    const borderClasses = border ? "border border-white/20 dark:border-white/10" : ""

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl shadow-lg",
          blurClasses[blur],
          variantClasses[variant],
          borderClasses,
          className
        )}
        {...props}
      />
    )
  }
)
GlassCard.displayName = "GlassCard"

export { GlassCard }
