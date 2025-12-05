import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    visualizer({
      open: false, // Don't open automatically in CI/CD
      gzipSize: true,
      brotliSize: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@project": path.resolve(__dirname, ".."),
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          ui: ['framer-motion', 'lucide-react', 'clsx'],
          // Markdown chunk replaced. Shiki is handled dynamically.
          markdown: ['marked', 'dompurify'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          state: ['zustand'],
        },
      },
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
})
