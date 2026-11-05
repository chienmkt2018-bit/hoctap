import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.STAGING_BASE_URL;
if (!baseURL) {
  throw new Error('STAGING_BASE_URL is required for direct staging verification');
}

export default defineConfig({
  testDir: './tests/rpg-dashboard',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-staging', open: 'never' }]],
  outputDir: 'test-results-staging',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
});
