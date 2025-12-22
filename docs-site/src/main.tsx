import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import ScrollToTop from './components/ScrollToTop'
import { getErrorMessage, redactSecrets, safeStringify } from './utils/logging'
import './index.css'

const DocsPage = lazy(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const SonnerToaster = Toaster as unknown as React.ComponentType<Record<string, unknown>>

const formatErrorForDisplay = (err: unknown) => {
	if (err instanceof Error) {
		return {
			header: getErrorMessage(err),
			detail: err.stack || getErrorMessage(err),
		}
	}

	const redacted = redactSecrets(err)
	const text = safeStringify(redacted)
	return {
		header: getErrorMessage(err),
		detail: text && text !== '{}' ? text : getErrorMessage(err),
	}
}

class RootErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ error: unknown }
> {
	state = { error: null as unknown }

	static getDerivedStateFromError(error: unknown) {
		return { error }
	}

	componentDidCatch(error: unknown, info: unknown) {
		const payload = {
			error: redactSecrets(error),
			info: redactSecrets(info),
		}
		console.error('RootErrorBoundary caught an error:', safeStringify(payload))
	}

	render() {
		if (this.state.error) {
			const formatted = formatErrorForDisplay(this.state.error)
			return (
				<div className="p-4 font-mono">
					<h1 className="text-lg mb-3">UI crashed</h1>
					<pre className="whitespace-pre-wrap opacity-90">
						{formatted.detail || formatted.header}
					</pre>
				</div>
			)
		}

		return this.props.children
	}
}

if (typeof window !== 'undefined') {
	const w = window as unknown as { __mediastackGlobalErrorHandlersInstalled?: boolean }
	if (!w.__mediastackGlobalErrorHandlersInstalled) {
		w.__mediastackGlobalErrorHandlersInstalled = true

		window.addEventListener('error', (event) => {
			const payload = {
				message: (event as ErrorEvent).message,
				error: redactSecrets((event as ErrorEvent).error),
				filename: (event as ErrorEvent).filename,
				lineno: (event as ErrorEvent).lineno,
				colno: (event as ErrorEvent).colno,
			}
			console.error('window.error', safeStringify(payload))
		})

		window.addEventListener('unhandledrejection', (event) => {
			const payload = {
				reason: redactSecrets((event as PromiseRejectionEvent).reason),
				stringified: safeStringify(redactSecrets((event as PromiseRejectionEvent).reason)),
			}
			console.error('window.unhandledrejection', safeStringify(payload))
		})
	}
}

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<RootErrorBoundary>
			<SonnerToaster richColors closeButton />
			<BrowserRouter>
				<ScrollToTop />
				<Routes>
					<Route path="/" element={<App />} />
					<Route
						path="/docs"
						element={
							<Suspense
								fallback={
									<div className="min-h-screen bg-background text-foreground flex items-center justify-center">
										<div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur px-4 py-3 shadow-lg">
											<div className="h-5 w-5 rounded-full border-2 border-border border-t-transparent animate-spin" />
											<span className="text-sm">Loading docs…</span>
										</div>
									</div>
								}
							>
								<DocsPage />
							</Suspense>
						}
					/>
					<Route
						path="/settings"
						element={
							<Suspense
								fallback={
									<div className="min-h-screen bg-background text-foreground flex items-center justify-center">
										<div className="flex items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur px-4 py-3 shadow-lg">
											<div className="h-5 w-5 rounded-full border-2 border-border border-t-transparent animate-spin" />
											<span className="text-sm">Loading settings…</span>
										</div>
									</div>
								}
							>
								<SettingsPage />
							</Suspense>
						}
					/>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</BrowserRouter>
		</RootErrorBoundary>
	</React.StrictMode>,
)
