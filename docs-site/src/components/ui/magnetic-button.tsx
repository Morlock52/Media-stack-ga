import * as React from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"
import { cn } from "@/lib/utils"

interface MagneticButtonProps {
  children: React.ReactNode
  magnetStrength?: number
  springConfig?: {
    stiffness: number
    damping: number
  }
  className?: string
}

export const MagneticButton = React.forwardRef<HTMLButtonElement, MagneticButtonProps>(
  ({ children, magnetStrength = 0.3, springConfig = { stiffness: 300, damping: 28 }, className }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const buttonRef = React.useRef<HTMLButtonElement>(null) as React.MutableRefObject<HTMLButtonElement | null>
    
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    
    const springX = useSpring(x, springConfig)
    const springY = useSpring(y, springConfig)

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      if (!buttonRef.current) return
      
      const rect = buttonRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      const deltaX = (e.clientX - centerX) * magnetStrength
      const deltaY = (e.clientY - centerY) * magnetStrength
      
      x.set(deltaX)
      y.set(deltaY)
    }, [magnetStrength, x, y])

    const handleMouseLeave = React.useCallback(() => {
      x.set(0)
      y.set(0)
    }, [x, y])

    React.useEffect(() => {
      const button = buttonRef.current
      if (!button) return

      button.addEventListener("mousemove", handleMouseMove as any)
      button.addEventListener("mouseleave", handleMouseLeave)
      
      return () => {
        button.removeEventListener("mousemove", handleMouseMove as any)
        button.removeEventListener("mouseleave", handleMouseLeave)
      }
    }, [handleMouseMove, handleMouseLeave])

    return (
      <motion.button
        ref={(node) => {
          buttonRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          "relative transition-transform duration-200",
          className
        )}
        style={{
          x: springX,
          y: springY,
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        {children}
        
        {/* Magnetic glow effect */}
        <motion.div
          className="absolute inset-0 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        />
      </motion.button>
    )
  }
)
MagneticButton.displayName = "MagneticButton"
