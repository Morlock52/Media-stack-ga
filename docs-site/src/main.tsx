import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import ScrollToTop from './components/ScrollToTop'
import './index.css'

const DocsPage = lazy(() => import('./pages/DocsPage').then((m) => ({ default: m.DocsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const SonnerToaster = Toaster as unknown as React.ComponentType<Record<string, unknown>>

class RootErrorBoundary extends React.Component<
	{ children: React.ReactNode },
	{ error: Error | null }
> {
	state = { error: null as Error | null }

	static getDerivedStateFromError(error: Error) {
		return { error }
	}

	componentDidCatch(error: Error) {
		console.error('RootErrorBoundary caught an error:', error)
	}

	render() {
		if (this.state.error) {
			return (
				<div className="p-4 font-mono">
					<h1 className="text-lg mb-3">UI crashed</h1>
					<pre className="whitespace-pre-wrap opacity-90">
						{this.state.error.stack || this.state.error.message}
					</pre>
				</div>
			)
		}

		return this.props.children
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
				</Routes>
			</BrowserRouter>
		</RootErrorBoundary>
	</React.StrictMode>,
)
