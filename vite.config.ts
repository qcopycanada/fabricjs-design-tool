import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const normalizeBase = (basePath?: string) => {
  if (!basePath || basePath.trim() === '') {
    return '/'
  }

  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use '/' by default (works for Vercel root deployments).
  // For subpath hosting (e.g. GitHub Pages), set VITE_BASE_PATH=/your-subpath/
  base: normalizeBase(process.env.VITE_BASE_PATH),
  build: {
    // Enable tree-shaking and optimization
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Optimize chunk splitting for better caching
        manualChunks: {
          vendor: ['react', 'react-dom'],
          fabric: ['fabric'],
          icons: ['lucide-react'],
          pdf: ['jspdf'],
          qr: ['qr-code-styling']
        }
      }
    },
    // Remove unused CSS and optimize
    cssCodeSplit: true,
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        dead_code: true,
        unused: true
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['fabric', 'react', 'react-dom'],
    exclude: ['lucide-react']
  }
})
