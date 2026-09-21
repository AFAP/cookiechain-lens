import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Deployed as a GitHub Pages project site, so assets must be requested under
// /<repo>/. Override with VITE_BASE when hosting elsewhere.
const base = process.env.VITE_BASE ?? '/cookiechain-lens/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // The whole app is one route; a single chunk keeps the Pages deploy simple.
    outDir: 'dist',
    sourcemap: false,
  },
})
