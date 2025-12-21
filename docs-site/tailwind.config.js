/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
    	extend: {
    		colors: {
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: 'hsl(var(--primary))',
    			secondary: 'hsl(var(--secondary))',
    			accent: 'hsl(var(--accent))',
    			card: 'hsl(var(--card))',
    			'card-foreground': 'hsl(var(--card-foreground))',
    			border: 'hsl(var(--border))',
    			midnight: '#030712',
    			neon: {
    				purple: '#7c3aed',
    				pink: '#f472b6',
					green: '#22c55e',
					cyan: '#22d3ee',
    				red: '#ef4444'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		fontFamily: {
    			sans: [
    				'Inter',
    				'Space Grotesk',
    				'sans-serif'
    			],
    			heading: [
    				'Space Grotesk',
    				'Outfit',
    				'sans-serif'
    			],
    			mono: [
    				'Share Tech Mono',
    				'JetBrains Mono',
    				'monospace'
    			]
    		},
    		animation: {
    			'spin-slow': 'spin 3s linear infinite',
    			float: 'float 6s ease-in-out infinite',
    			'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    		},
    		keyframes: {
    			float: {
    				'0%, 100%': {
    					transform: 'translateY(0)'
    				},
    				'50%': {
    					transform: 'translateY(-20px)'
    				}
    			},
    			'pulse-glow': {
    				'0%, 100%': {
    					opacity: 1,
    					boxShadow: '0 0 20px var(--primary)'
    				},
    				'50%': {
    					opacity: 0.5,
    					boxShadow: '0 0 10px var(--primary)'
    				}
    			}
    		}
    	}
    },
    plugins: [],
}
