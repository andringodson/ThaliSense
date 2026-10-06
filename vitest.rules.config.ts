import { defineConfig } from 'vitest/config'

// Firestore security rules tests; need the emulator (npm run test:rules starts it).
export default defineConfig({ test: { include: ['tests/rules/**/*.test.ts'], testTimeout: 20_000 } })
