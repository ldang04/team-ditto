import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * These tests verify the full end-to-end flow:
 *   Browser → React Client → Express Backend → Firestore + Vertex AI
 *
 * The webServer config automatically starts both servers before tests run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially to maintain state between tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to ensure test order
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Timeout for each test
  timeout: 60000,
  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },
  // Auto-start both servers before running tests
  webServer: [
    {
      // Start backend server first
      command: 'npm start',
      cwd: '../',  // Backend is in parent directory
      url: 'http://localhost:3000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      // Start client dev server (proxies /api to backend)
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
