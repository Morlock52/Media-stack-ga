import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Global Error Boundary for catching unhandled React errors.
 *
 * Provides a user-friendly error screen with:
 * - Error message display
 * - Reload button to recover
 * - Copy error details for bug reports
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // In production, you could send this to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReload = () => {
    // Clear error state and reload
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleCopyError = () => {
    const errorText = `Error: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}`
    navigator.clipboard.writeText(errorText)
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                The application encountered an unexpected error.
                Please try reloading the page.
              </p>
            </div>

            {/* Error Details (collapsible) */}
            {this.state.error && (
              <details className="text-left bg-muted/50 rounded-lg p-4 text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-destructive font-mono overflow-auto max-h-40">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
              {this.state.error && (
                <Button
                  variant="outline"
                  onClick={this.handleCopyError}
                >
                  Copy Error
                </Button>
              )}
            </div>

            {/* Help Link */}
            <p className="text-xs text-muted-foreground">
              If this keeps happening, please{' '}
              <a
                href="https://github.com/anthropics/claude-code/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                report an issue
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
