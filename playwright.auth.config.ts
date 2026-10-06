import { defineConfig, devices } from '@playwright/test'

// Sign-in and sync tests against the Firebase Auth and Firestore emulators.
export default defineConfig({
  testDir: 'tests/auth',
  timeout: 90_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4174', colorScheme: 'dark', ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } },
  webServer: [
    {
      command: 'npx firebase emulators:start --project demo-thalisense --only auth,firestore',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npx vite build --mode emulator --outDir dist-emulator && npx vite preview --outDir dist-emulator --port 4174 --strictPort',
      url: 'http://localhost:4174',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
})
