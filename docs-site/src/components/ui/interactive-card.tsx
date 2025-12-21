import * as React from "react"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { cn } from "@/lib/utils"

interface InteractiveCardProps {
  children: React.ReactNode
  tiltStrength?: number
  scaleOnHover?: number
  glowIntensity?: number
  className?: string
}

export const InteractiveCard = React.forwardRef<HTMLDivElement, InteractiveCardProps>(
  ({ 
    children, 
    tiltStrength = 15, 
    scaleOnHover = 1.05, 
    glowIntensity = 0.3,
    className
  }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const cardRef = React.useRef<HTMLDivElement>(null) as React.MutableRefObject<HTMLDivElement | null>
    
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    
    const springX = useSpring(x, { stiffness: 300, damping: 30 })
    const springY = useSpring(y, { stiffness: 300, damping: 30 })
    
    const rotateX = useTransform(springY, [-0.5, 0.5], [tiltStrength, -tiltStrength])
    const rotateY = useTransform(springX, [-0.5, 0.5], [-tiltStrength, tiltStrength])

    const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return
      
      const rect = cardRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      
      const deltaX = (e.clientX - centerX) / rect.width
      const deltaY = (e.clientY - centerY) / rect.height
      
      x.set(deltaX)
      y.set(deltaY)
    }, [x, y])

    const handleMouseLeave = React.useCallback(() => {
      x.set(0)
      y.set(0)
    }, [x, y])

    return (
      <motion.div
        ref={(node) => {
          cardRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        className={cn(
          "relative cursor-pointer transition-transform duration-200 preserve-3d",
          className
        )}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        whileHover={{ scale: scaleOnHover }}
        whileTap={{ scale: 0.98 }}
      >
        {children}
        
        {/* Dynamic glow effect */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-xl"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: isHovered ? glowIntensity : 0,
            scale: isHovered ? 1.1 : 1
          }}
          transition={{ 
            duration: 0.3,
            ease: "easeOut"
          }}
        />
        
        {/* Highlight effect */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/10 to-transparent"
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          animate={{
            opacity: isHovered ? 1 : 0
          }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    )
  }
)
InteractiveCard.displayName = "InteractiveCard"
