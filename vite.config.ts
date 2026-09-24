import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`        → dist/        (code-split, for hosting: Netlify / Vercel / nginx)
// `npm run build:single` → dist-single/ (one self-contained HTML, opens offline by double-click)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2020',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 900,
      rollupOptions: single
        ? {}
        : {
            output: {
              manualChunks: { three: ['three'], motion: ['framer-motion'] },
            },
          },
    },
  }
})
