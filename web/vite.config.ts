import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite config tuned for being bundled inside the iOS app.
 *
 * `base: './'` makes every asset URL emitted by Vite relative to the
 * page that hosts it. That's what lets the WKWebView load the built
 * app from inside the app's resources via a custom URL scheme without
 * any rewriting at runtime.
 *
 * `target: 'safari15'` matches the iOS 15+ WebKit feature set we
 * support, so Vite won't transpile away modern features Safari already
 * understands (smaller, faster bundle).
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'safari15',
    assetsInlineLimit: 0,
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  clearScreen: false,
})
