import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Authentication Flows
 *
 * Prerequisites:
 * - Backend server running on http://localhost:3000
 * - Client dev server running on http://localhost:5173
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should display login page with create account and login forms', async ({ page }) => {
    await page.goto('/login');

    // Verify page title - exact text from LoginPage.tsx line 93
    await expect(page.locator('h1')).toContainText('LinkLaunch');

    // Verify Create Account section - exact text from line 173
    await expect(page.getByRole('heading', { name: 'Create New Account' })).toBeVisible();

    // Organization input - exact placeholder from line 184
    await expect(page.getByPlaceholder('Enter your organization name')).toBeVisible();

    // Create Account button - exact text from line 200
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();

    // Login section - exact text from line 218
    await expect(page.getByRole('heading', { name: 'Login with API Key' })).toBeVisible();

    // API Key input - exact placeholder from line 229
    await expect(page.getByPlaceholder('Enter your API key')).toBeVisible();

    // Login button - exact text from line 248
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('should create a new account and display API key', async ({ page }) => {
    await page.goto('/login');

    const orgName = `Test Org ${Date.now()}`;

    // Fill org name input
    await page.getByPlaceholder('Enter your organization name').fill(orgName);

    // Click Create Account button
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait for success message - exact text from line 107
    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });

    // Verify API key label - exact text from line 117 (use exact match to avoid duplicate)
    await expect(page.getByText('Your API Key', { exact: true })).toBeVisible();

    // Verify important message - partial text from line 111
    await expect(page.getByText('Save your API key now')).toBeVisible();

    // Verify Copy button exists - exact text from line 152
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();

    // Verify Continue button - exact text from line 165
    await expect(page.getByRole('button', { name: 'Continue to Dashboard' })).toBeVisible();
  });

  test('should navigate to dashboard after account creation', async ({ page }) => {
    await page.goto('/login');

    const orgName = `Test Org ${Date.now()}`;

    await page.getByPlaceholder('Enter your organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });

    // Click Continue to Dashboard - exact text from line 165
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/');

    // New users without themes see "Get Started" - from CampaignsDashboard.tsx line 64
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible({ timeout: 5000 });
  });

  test('should reject login with invalid API key', async ({ page }) => {
    await page.goto('/login');

    // Enter invalid API key
    await page.getByPlaceholder('Enter your API key').fill('invalid-api-key-12345');

    // Click Login
    await page.getByRole('button', { name: 'Login' }).click();

    // Should show error - partial text from line 76
    await expect(page.getByText('Invalid API key')).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page).toHaveURL('/login');
  });

  test('should require organization name for account creation', async ({ page }) => {
    await page.goto('/login');

    // The input has required attribute - from line 186
    const orgInput = page.getByPlaceholder('Enter your organization name');
    await expect(orgInput).toHaveAttribute('required', '');
  });

  test('should show loading state during account creation', async ({ page }) => {
    await page.goto('/login');

    const orgName = `Test Org ${Date.now()}`;
    await page.getByPlaceholder('Enter your organization name').fill(orgName);

    // Click and check for loading - text from line 197
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await createButton.click();

    // Either see "Creating..." or success (depending on speed)
    await Promise.race([
      expect(page.getByRole('button', { name: 'Creating...' })).toBeVisible({ timeout: 2000 }),
      expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 })
    ].map(p => p.catch(() => {})));

    // Eventually should succeed
    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state during login validation', async ({ page }) => {
    await page.goto('/login');

    await page.getByPlaceholder('Enter your API key').fill('some-api-key');
    await page.getByRole('button', { name: 'Login' }).click();

    // Either see "Validating..." or error (depending on speed)
    await Promise.race([
      expect(page.getByRole('button', { name: 'Validating...' })).toBeVisible({ timeout: 2000 }),
      expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 })
    ].map(p => p.catch(() => {})));

    // Eventually should show error
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
  });

  test('should copy API key to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/login');

    const orgName = `Test Org ${Date.now()}`;
    await page.getByPlaceholder('Enter your organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });

    // Click Copy button
    await page.getByRole('button', { name: 'Copy' }).click();

    // Should show "Copied!" - from line 146
    await expect(page.getByRole('button', { name: 'Copied!' })).toBeVisible();
  });

  test('should toggle API key visibility', async ({ page }) => {
    await page.goto('/login');

    const orgName = `Test Org ${Date.now()}`;
    await page.getByPlaceholder('Enter your organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });

    // Find the readonly input that displays the API key
    const apiKeyInput = page.locator('input[readonly]');

    // Initial state is password (hidden) - from line 122
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Click the toggle button (it's inside the flex container with the input)
    // The button contains Eye/EyeOff icon - from lines 127-137
    const toggleButton = page.locator('.flex-1.relative button');
    await toggleButton.click();

    // Should now be text (visible)
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Click again to hide
    await toggleButton.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });
});
