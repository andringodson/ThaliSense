/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same isolation header as production (vercel.json): cross-origin isolation for
// multi-threaded WASM, without COOP, so sign-in popups keep working.
const isolation = { 'Document-Isolation-Policy': 'isolate-and-credentialless' }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  // Unit tests live next to the code; Playwright owns tests/e2e.
  test: { include: ['src/**/*.test.ts'] },
})
