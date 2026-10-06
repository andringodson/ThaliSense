/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same isolation headers as production (vercel.json), so WASM threads work locally too.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  // Unit tests live next to the code; Playwright owns tests/e2e.
  test: { include: ['src/**/*.test.ts'] },
})
