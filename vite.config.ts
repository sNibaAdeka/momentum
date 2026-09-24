import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build`        → dist/        (code-split, for hosting: Netlify / Vercel / nginx)
// `npm run build:single` → dist-single/ (one self-contained HTML, opens offline by double-click)
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    // scan only the app entry (dist-single/index.html would otherwise be crawled for deps)
    optimizeDeps: { entries: ['index.html'], include: ['three', 'fflate', 'dicom-parser', 'nifti-reader-js'] },
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
