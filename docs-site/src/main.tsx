import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import { DocsPage } from './pages/DocsPage'
import { SettingsPage } from './pages/SettingsPage'
import ScrollToTop from './components/ScrollToTop'
import './index.css'

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
					<Route path="/docs" element={<DocsPage />} />
					<Route path="/settings" element={<SettingsPage />} />
				</Routes>
			</BrowserRouter>
		</RootErrorBoundary>
	</React.StrictMode>,
)
