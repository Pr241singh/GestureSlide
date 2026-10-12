import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single-page app. No router, so the production build does not need a rewrite rule.
export default defineConfig({
  plugins: [react()],
})
