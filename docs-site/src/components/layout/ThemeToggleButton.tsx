import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui/button'
import { useTheme } from '../../hooks/useTheme'

export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <Button
      type="button"
      variant="glass"
      size="icon"
      onClick={toggleTheme}
      className={className}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4 text-muted-foreground" />
      ) : (
        <Moon className="w-4 h-4 text-muted-foreground" />
      )}
    </Button>
  )
}

