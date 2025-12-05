import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * These tests verify the full end-to-end flow:
 *   Browser → React Client → Express Backend → Supabase + Vertex AI
 *
 * Usage:
 *   npm run test:e2e          - Tests against local backend (auto-starts servers)
 *   USE_GCP=true npm run test:e2e - Tests against GCP backend (update vite.config.ts first)
 */

// When USE_GCP is set, only start the client (backend is on GCP)
const useGCP = process.env.USE_GCP === 'true';

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
  // Timeout for each test (longer for GCP due to network latency)
  timeout: useGCP ? 90000 : 60000,
  // Expect timeout for assertions
  expect: {
    timeout: useGCP ? 15000 : 10000,
  },
  // Auto-start servers before running tests
  webServer: useGCP
    ? [
        {
          // Only start client (proxies /api to GCP backend via vite.config.ts)
          command: 'npm run dev',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 30000,
        },
      ]
    : [
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
