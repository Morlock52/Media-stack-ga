import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { DocsPage } from './pages/DocsPage'
import { ServiceGeneratorPage } from './pages/ServiceGeneratorPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<App />} />
				<Route path="/docs" element={<DocsPage />} />
				<Route path="/add-service" element={<ServiceGeneratorPage />} />
			</Routes>
		</BrowserRouter>
	</React.StrictMode>,
)
