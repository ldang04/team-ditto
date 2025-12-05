import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Content Generation Flow
 *
 * Prerequisites:
 * - Backend server running on http://localhost:3000
 * - Client dev server running on http://localhost:5173
 *
 * Note: Content generation tests are slower due to AI processing time.
 */

test.describe('Content Generation', () => {
  // Setup: Create account, brand, and campaign before each test
  test.beforeEach(async ({ page }) => {
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
    await page.getByPlaceholder('Acme Inc').fill('TechCorp');
    await page.getByPlaceholder('modern, friendly, professional').fill('modern, tech, innovative');
    await page.getByPlaceholder('Apple, Stripe, Notion').fill('Apple');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Summer Sale, Product Launch...').fill('Product Launch');
    await page.getByPlaceholder('Small business owners, young professionals...').fill('Tech professionals');
    await page.getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should navigate to content writer page from dashboard', async ({ page }) => {
    await page.goto('/');

    // Click on the campaign link - from CampaignsDashboard.tsx line 156
    await page.getByRole('link', { name: 'Product Launch' }).click();

    // Should be on campaign detail page
    await expect(page).toHaveURL(/\/campaigns\/.+/);
  });

  test('should navigate to create page directly', async ({ page }) => {
    await page.goto('/create');

    // Should show the AI assistant welcome message - from LinkedInWriter.tsx line 54
    await expect(page.getByText('Hi! I can help you write your LinkedIn post')).toBeVisible({ timeout: 5000 });
  });

  test('should display campaign selector in toolbar', async ({ page }) => {
    await page.goto('/create');

    // Campaign selector - from LinkedInWriter.tsx line 329-346
    const select = page.locator('select');
    await expect(select).toBeVisible();

    // Should have "Select campaign..." option - from line 337
    await expect(select).toContainText('Select campaign...');
  });

  test('should select a campaign from dropdown', async ({ page }) => {
    await page.goto('/create');

    // Select the campaign we created by index (first non-empty option)
    const select = page.locator('select');
    await select.selectOption({ index: 1 });

    // After selecting, the option should be selected
    await expect(select).not.toHaveValue('');
  });

  test('should display chat interface with AI Assistant', async ({ page }) => {
    await page.goto('/create');

    // AI Assistant header - from line 629 (use exact match to avoid duplicate matches)
    await expect(page.locator('.font-medium').filter({ hasText: 'AI Assistant' })).toBeVisible();

    // Welcome message - from line 54
    await expect(page.getByText('Hi! I can help you write your LinkedIn post')).toBeVisible();
  });

  test('should show chat input when campaign is selected', async ({ page }) => {
    await page.goto('/create');

    // Without campaign selected, shows message - from line 678
    await expect(page.getByText('Select a campaign to use AI')).toBeVisible();

    // Select campaign by index
    await page.locator('select').selectOption({ index: 1 });

    // Now chat input should be visible - placeholder from line 687
    await expect(page.getByPlaceholder('Write about... or generate image...')).toBeVisible();
  });

  test('should have quick action buttons', async ({ page }) => {
    await page.goto('/create');

    // Select campaign first
    await page.locator('select').selectOption({ index: 1 });

    // Quick action buttons - from lines 704-716 (case sensitive: "Write post", "Add image")
    // These are the small buttons in the chat input area (not the big dashed "Add Image" button)
    await expect(page.getByRole('button', { name: 'Write post', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add image', exact: true })).toBeVisible();
  });

  test('should send message in chat', async ({ page }) => {
    await page.goto('/create');

    // Select campaign
    await page.locator('select').selectOption({ index: 1 });

    // Type a message
    const chatInput = page.getByPlaceholder('Write about... or generate image...');
    await chatInput.fill('Write a short product announcement');

    // Click send button - it's the purple button with Send icon
    await page.locator('button.bg-purple-600').last().click();

    // User message should appear in chat - it's displayed in a blue bubble from lines 648-651
    await expect(page.locator('.bg-blue-600').filter({ hasText: 'Write a short product announcement' })).toBeVisible({ timeout: 5000 });
  });

  test('should show character count', async ({ page }) => {
    await page.goto('/create');

    // Character count display - from lines 360-362
    // Format is "0 / 3,000"
    await expect(page.getByText('/ 3,000')).toBeVisible();
  });

  test('should have copy button in toolbar', async ({ page }) => {
    await page.goto('/create');

    // Copy button - from lines 364-371, has title="Copy to clipboard"
    await expect(page.locator('button[title="Copy to clipboard"]')).toBeVisible();
  });

  test('should have Check (validate) button', async ({ page }) => {
    await page.goto('/create');

    // Check button - from lines 373-384, text is "Check"
    await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
  });

  test('should toggle chat panel', async ({ page }) => {
    await page.goto('/create');

    // Chat panel is open by default - from line 48 chatOpen = true
    // The panel header has "AI Assistant" text in a span with font-medium class
    const aiAssistantHeader = page.getByText('AI Assistant', { exact: true });
    await expect(aiAssistantHeader).toBeVisible();

    // The floating button should NOT be visible when panel is open
    const floatingButton = page.locator('button.fixed.bg-purple-600');
    await expect(floatingButton).not.toBeVisible();

    // Click X button to close chat panel
    // The X button is inside the fixed right panel header (from lines 631-636 in LinkedInWriter.tsx)
    // Find the button that's in the same gradient header as "AI Assistant" text
    const panelHeader = page.locator('.from-purple-50');
    const closeButton = panelHeader.locator('button');
    await closeButton.click();

    // Wait a moment for the CSS transition
    await page.waitForTimeout(400);

    // Floating button appears when chat is closed - from lines 722-728
    // It's a fixed button with Sparkles icon that appears at bottom right
    await expect(floatingButton).toBeVisible();

    // Click floating button to reopen
    await floatingButton.click();

    // Wait for transition
    await page.waitForTimeout(400);

    // Floating button should disappear when panel reopens
    await expect(floatingButton).not.toBeVisible();
  });

  test('should show Add Image button when no image exists', async ({ page }) => {
    await page.goto('/create');

    // Add Image button - from lines 470-476 (the big dashed button with "Add Image" exact)
    await expect(page.getByRole('button', { name: 'Add Image', exact: true })).toBeVisible();
  });

  test('should show image input options when Add Image clicked', async ({ page }) => {
    await page.goto('/create');

    // Click Add Image (the big dashed button)
    await page.getByRole('button', { name: 'Add Image', exact: true }).click();

    // Should show tabs for Upload, URL, AI Generate - from lines 481-514
    // Use exact match to avoid conflicts with "Click to upload" button
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'URL', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'AI Generate', exact: true })).toBeVisible();
  });

  test('should show URL input when URL tab is selected', async ({ page }) => {
    await page.goto('/create');

    await page.getByRole('button', { name: 'Add Image', exact: true }).click();

    // Click URL tab
    await page.getByRole('button', { name: 'URL', exact: true }).click();

    // Should show URL input - placeholder from line 548
    await expect(page.getByPlaceholder('https://example.com/image.jpg')).toBeVisible();

    // Add button - from line 554 (use exact match to avoid matching "Add image")
    await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  });

  test('should show AI Generate options when tab is selected', async ({ page }) => {
    await page.goto('/create');

    await page.getByRole('button', { name: 'Add Image', exact: true }).click();

    // Click AI Generate tab
    await page.getByRole('button', { name: 'AI Generate' }).click();

    // Should show prompt input - placeholder from line 568
    await expect(page.getByPlaceholder('e.g. A modern office with people collaborating')).toBeVisible();

    // Generate Image button - from line 583
    await expect(page.getByRole('button', { name: 'Generate Image' })).toBeVisible();
  });

  test('should cancel image input', async ({ page }) => {
    await page.goto('/create');

    await page.getByRole('button', { name: 'Add Image', exact: true }).click();

    // Verify image options are visible (use exact match for tab buttons)
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeVisible();

    // Cancel button - from line 598
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Should hide image input options and show Add Image again
    await expect(page.getByRole('button', { name: 'Add Image', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload', exact: true })).not.toBeVisible();
  });

  test('should show empty state helper', async ({ page }) => {
    await page.goto('/create');

    // Empty state helper - from lines 608-617
    await expect(page.getByText('Start typing or use the AI assistant to get started')).toBeVisible();

    // Open AI Assistant link - from line 614
    await expect(page.getByRole('button', { name: 'Open AI Assistant →' })).toBeVisible();
  });
});

test.describe('Content Generation - AI Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const orgName = `Test Org ${Date.now()}`;
    await page.getByPlaceholder('Enter your organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Account Created Successfully!')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Continue to Dashboard' }).click();

    await page.getByRole('link', { name: 'Get Started' }).click();
    await page.getByPlaceholder('Acme Inc').fill('TechCorp');
    await page.getByPlaceholder('modern, friendly, professional').fill('modern, professional');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Create your first campaign' })).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Summer Sale, Product Launch...').fill('Test Campaign');
    await page.getByPlaceholder('Small business owners, young professionals...').fill('Everyone');
    await page.getByRole('button', { name: 'Create Campaign' }).click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should generate content when prompted', async ({ page }) => {
    test.setTimeout(120000); // AI generation can be slow

    await page.goto('/create');

    // Select campaign by index
    await page.locator('select').selectOption({ index: 1 });

    // Type a prompt
    const chatInput = page.getByPlaceholder('Write about... or generate image...');
    await chatInput.fill('Write a short LinkedIn post about productivity tips');
    await chatInput.press('Enter');

    // Should show loading state - from lines 664-669
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 10000 });

    // Wait for response - from line 167, assistant replies with "Done! I've updated your post"
    await expect(page.getByText("Done! I've updated your post")).toBeVisible({ timeout: 90000 });
  });

  test('should show validation results', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/create');
    await page.locator('select').selectOption({ index: 1 });

    // Generate some content first
    const chatInput = page.getByPlaceholder('Write about... or generate image...');
    await chatInput.fill('Write about innovation');
    await chatInput.press('Enter');
    await expect(page.getByText("Done! I've updated your post")).toBeVisible({ timeout: 90000 });

    // Click Check button
    await page.getByRole('button', { name: 'Check' }).click();

    // Should show validation result - from lines 392-431
    // Either "On Brand" or "Needs Work" - from lines 408-409
    await expect(page.getByText(/On Brand|Needs Work/)).toBeVisible({ timeout: 30000 });

    // Should show score - format "XX / 100" from line 418
    await expect(page.getByText('/ 100')).toBeVisible();
  });
});
