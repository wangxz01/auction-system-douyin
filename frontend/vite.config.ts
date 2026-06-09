import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // hls.js is isolated behind a dynamic import; keep the warning threshold above
    // that optional vendor chunk while still catching accidental large route bundles.
    chunkSizeWarningLimit: 600,
  },
})
