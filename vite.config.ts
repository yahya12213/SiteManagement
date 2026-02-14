import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// Build directly into server/dist to fix Railway deployment
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'server/dist',
    emptyOutDir: true,
    // Cache busting: Include content hash in filenames
    // This forces browsers to download new files after each deployment
    rollupOptions: {
      output: {
        // Include hash in JS chunk filenames
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Generate source maps for debugging
    sourcemap: false,
    // Minify for production
    minify: 'esbuild',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    strictPort: false,
  },
})
