import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Brand Setup Flow
 *
 * Prerequisites:
 * - Backend server running on http://localhost:3000
 * - Client dev server running on http://localhost:5173
 */

test.describe('Brand Setup', () => {
  test.beforeEach(async ({ page }) => {
    // Create a fresh account for each test
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const orgName = `Test Org ${Date.now()}`;
    await page.getByPlaceholder('Enter your organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });

    // Continue to dashboard
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should show Get Started button for new users', async ({ page }) => {
    // New users without themes see "Get Started" link - from CampaignsDashboard.tsx line 60-66
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible({ timeout: 5000 });

    // Also shows welcome text - from line 58
    await expect(page.getByText('Set up your company to start creating content.')).toBeVisible();
  });

  test('should navigate to brand setup page', async ({ page }) => {
    await page.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/setup');

    // Should show Company step - from BrandSetup.tsx line 71
    await expect(page.getByRole('heading', { name: 'Tell us about your company' })).toBeVisible();

    // Label for company name - from line 78
    await expect(page.getByText('Company name')).toBeVisible();
  });

  test('should complete company setup step', async ({ page }) => {
    await page.goto('/setup');

    // Fill in company details - placeholders from lines 83, 95, 107
    await page.getByPlaceholder('Acme Inc').fill('Test Company');
    await page.getByPlaceholder('modern, friendly, professional').fill('modern, tech, innovative');
    await page.getByPlaceholder('Apple, Stripe, Notion').fill('Apple, Google');

    // Click Continue - from line 121
    await page.getByRole('button', { name: 'Continue' }).click();

    // Should progress to Campaign step - from line 133
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 10000 });
  });

  test('should complete full brand setup flow', async ({ page }) => {
    await page.goto('/setup');

    // Step 1: Company
    await page.getByPlaceholder('Acme Inc').fill('Test Company');
    await page.getByPlaceholder('modern, friendly, professional').fill('modern, tech');
    await page.getByPlaceholder('Apple, Stripe, Notion').fill('Apple');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2: Campaign - from lines 144-145, 157
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Summer Sale, Product Launch...').fill('Q1 Launch');
    await page.getByPlaceholder('Small business owners, young professionals...').fill('Tech professionals');
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    // Step 3: Complete - from line 187
    await expect(page.getByText("You're all set!")).toBeVisible({ timeout: 10000 });

    // Subtitle - from line 188
    await expect(page.getByText('Taking you to your dashboard...')).toBeVisible();

    // Should redirect to dashboard after 1.5s timeout
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });

  test('should require company name to proceed', async ({ page }) => {
    await page.goto('/setup');

    // Button should be disabled without input - from line 114
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await expect(continueButton).toBeDisabled();

    // Fill in company name
    await page.getByPlaceholder('Acme Inc').fill('Test Company');

    // Now button should be enabled
    await expect(continueButton).toBeEnabled();
  });

  test('should show progress indicator', async ({ page }) => {
    await page.goto('/setup');

    // Progress steps - from lines 61, 63, 65
    await expect(page.getByText('Company').first()).toBeVisible();
    await expect(page.getByText('Campaign')).toBeVisible();
    await expect(page.getByText('Done')).toBeVisible();
  });

  test('should handle company style as comma-separated tags', async ({ page }) => {
    await page.goto('/setup');

    // Fill with multiple comma-separated tags
    await page.getByPlaceholder('Acme Inc').fill('Test Company');
    await page.getByPlaceholder('modern, friendly, professional').fill('tech, modern, professional, innovative');

    // Should show hint about comma separation - from line 98
    await expect(page.getByText('Separate with commas')).toBeVisible();

    // Continue to verify tags are processed
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 10000 });
  });

  test('should require campaign fields to create campaign', async ({ page }) => {
    // This test uses the beforeEach which creates account and goes to dashboard
    // Wait for dashboard to load and show Get Started link
    await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible({ timeout: 10000 });

    // Now navigate to setup
    await page.getByRole('link', { name: 'Get Started' }).click();
    await expect(page).toHaveURL('/setup');

    // Complete company step - fill in required field and optional style
    await page.getByPlaceholder('Acme Inc').fill('Test Company');
    await page.getByPlaceholder('modern, friendly, professional').fill('modern, tech');

    // Click Continue and wait for API call to complete
    await page.getByRole('button', { name: 'Continue' }).click();

    // Wait for the campaign step to appear (API creates theme first)
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 15000 });

    // Create Campaign button should be disabled initially - from line 165
    const createButton = page.getByRole('button', { name: 'Create Campaign' });
    await expect(createButton).toBeDisabled();

    // Fill only campaign name
    await page.getByPlaceholder('Summer Sale, Product Launch...').fill('Test Campaign');
    await expect(createButton).toBeDisabled();

    // Fill audience - now should be enabled
    await page.getByPlaceholder('Small business owners, young professionals...').fill('Everyone');
    await expect(createButton).toBeEnabled();
  });
});

test.describe('Dashboard with Existing Brand', () => {
  test.beforeEach(async ({ page }) => {
    // Create account and complete full setup
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const orgName = `Test Org ${Date.now()}`;
    await page.getByPlaceholder('Enter your organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();

    // Complete brand setup
    await page.getByRole('link', { name: 'Get Started' }).click();
    await page.getByPlaceholder('Acme Inc').fill('Test Company');
    await page.getByPlaceholder('modern, friendly, professional').fill('modern');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Summer Sale, Product Launch...').fill('Test Campaign');
    await page.getByPlaceholder('Small business owners, young professionals...').fill('Professionals');
    await page.getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should display campaigns on dashboard', async ({ page }) => {
    await page.goto('/');

    // Should show Campaigns header - from CampaignsDashboard.tsx line 76
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();

    // Should show the created campaign - from line 163 (it's inside a Link as h3)
    await expect(page.getByRole('heading', { name: 'Test Campaign' })).toBeVisible();

    // Should show the company in Companies section - from line 190 (it's in a span tag)
    await expect(page.locator('span').filter({ hasText: 'Test Company' })).toBeVisible();
  });

  test('should allow creating new campaign from dashboard', async ({ page }) => {
    await page.goto('/');

    // Click New button - from line 84
    await page.getByRole('button', { name: 'New' }).click();

    // Should show new campaign form - from line 91
    await expect(page.getByRole('heading', { name: 'New Campaign' })).toBeVisible();

    // Input with placeholder - from line 99
    await expect(page.getByPlaceholder('Summer Sale, Product Launch...')).toBeVisible();

    // Fill form
    await page.getByPlaceholder('Summer Sale, Product Launch...').fill('Second Campaign');

    // Select company from dropdown - from lines 106-118
    await page.locator('select').selectOption({ label: 'Test Company' });

    // Create button - from line 126
    await page.getByRole('button', { name: 'Create' }).click();

    // New campaign should appear
    await expect(page.getByText('Second Campaign')).toBeVisible({ timeout: 5000 });
  });

  test('should cancel new campaign creation', async ({ page }) => {
    await page.goto('/');

    // Click New button
    await page.getByRole('button', { name: 'New' }).click();
    await expect(page.getByRole('heading', { name: 'New Campaign' })).toBeVisible();

    // Click Cancel - from line 133
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Form should be hidden
    await expect(page.getByRole('heading', { name: 'New Campaign' })).not.toBeVisible();
  });

  test('should navigate to campaign detail page', async ({ page }) => {
    await page.goto('/');

    // Click on the campaign - it's a Link component from line 156-170
    await page.getByRole('link', { name: 'Test Campaign' }).click();

    // Should navigate to campaign detail
    await expect(page).toHaveURL(/\/campaigns\/.+/);
  });

  test('should link to add company from dashboard', async ({ page }) => {
    await page.goto('/');

    // Click Add company link - from line 180
    await page.getByRole('link', { name: 'Add company' }).click();

    // Should navigate to setup
    await expect(page).toHaveURL('/setup');
  });
});
