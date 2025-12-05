# CopyForge End-to-End Test Checklist

This document provides both automated and manual test options for verifying the complete client-service integration.

## Automated E2E Tests (Playwright)

We have automated E2E tests using Playwright that cover the core user flows.

### Running Automated Tests

```bash
# Run all E2E tests (servers auto-start via playwright.config.ts)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run with interactive UI
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

> **Note:** The Playwright config automatically starts both the backend (port 3000) and frontend (port 5173) servers. No manual server startup required.

### Test Files
- `e2e/auth.spec.ts` - Account creation, login, API key handling
- `e2e/brand-setup.spec.ts` - Company/theme setup, campaign creation
- `e2e/content-generation.spec.ts` - Content writer, chat interface, generation

### Automated Test Coverage (42 tests)
| File | Tests | Coverage |
|------|-------|----------|
| `auth.spec.ts` | 9 | Account creation, API key display, login validation |
| `brand-setup.spec.ts` | 13 | Onboarding wizard, theme/campaign creation, dashboard |
| `content-generation.spec.ts` | 20 | Text generation, chat interface, validation, image options |

*Playwright tests were developed with assistance from Claude (Anthropic)*

---

## Manual Test Checklist

For comprehensive testing or when automated tests aren't sufficient, use this manual checklist.

### Prerequisites

- [ ] Ditto API backend is running (locally or on GCP)
- [ ] CopyForge client is running (`npm run dev`)
- [ ] Browser developer tools open (Console + Network tabs)

---

## Test 1: Account Creation

**Purpose:** Verify new user registration and API key generation

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 1.1 | Navigate to `http://localhost:5173` | Login page displayed with "CopyForge" branding | - | [ ] |
| 1.2 | Enter organization name: "Test Company ABC" | Input accepts text | - | [ ] |
| 1.3 | Click "Create Account" | Loading spinner appears | `POST /api/clients/create` | [ ] |
| 1.4 | Wait for response | Redirected to dashboard, API key stored | Response: 201 Created | [ ] |
| 1.5 | Check localStorage | `brandforge_api_key` contains valid key | - | [ ] |

**Expected Logs (Server):**
```
POST /api/clients/create - 201
```

---

## Test 2: Login with Existing API Key

**Purpose:** Verify returning user authentication

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 2.1 | Logout (if logged in) | Redirected to login page | - | [ ] |
| 2.2 | Enter valid API key from Test 1 | Input accepts key | - | [ ] |
| 2.3 | Click "Login" | Loading spinner, then redirect to dashboard | `GET /api/projects` (validation) | [ ] |
| 2.4 | Enter invalid API key: "invalid-key-123" | Error message: "Invalid API key" | `GET /api/projects` returns 401/403 | [ ] |

---

## Test 3: Brand Setup (First-Time User Flow)

**Purpose:** Verify onboarding wizard creates theme and campaign

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 3.1 | As new user, click "Set Up Your Brand" | Brand setup wizard appears | - | [ ] |
| 3.2 | Enter brand name: "TechCorp" | Input accepts text | - | [ ] |
| 3.3 | Enter keywords: "modern, innovative, professional" | Input accepts text | - | [ ] |
| 3.4 | Enter inspirations: "Apple, Google, Stripe" | Input accepts text | - | [ ] |
| 3.5 | Click "Continue" | Theme created, moves to campaign step | `POST /api/themes/create` - 201 | [ ] |
| 3.6 | Enter campaign name: "Summer Launch" | Input accepts text | - | [ ] |
| 3.7 | Enter target audience: "Tech professionals" | Input accepts text | - | [ ] |
| 3.8 | Click "Create Campaign" | Campaign created, redirected to dashboard | `POST /api/projects/create` - 201 | [ ] |

---

## Test 4: Campaign Dashboard

**Purpose:** Verify campaign listing and creation

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 4.1 | Navigate to dashboard (/) | Campaigns list displayed | `GET /api/projects`, `GET /api/themes` | [ ] |
| 4.2 | Verify "Summer Launch" campaign appears | Campaign card with theme name shown | - | [ ] |
| 4.3 | Click "New Campaign" | New campaign form appears | - | [ ] |
| 4.4 | Create campaign "Winter Sale" with theme | Campaign added to list | `POST /api/projects/create` - 201 | [ ] |
| 4.5 | Click "Open Workspace" | Navigated to /workspace | - | [ ] |

---

## Test 5: Content Generation (Text)

**Purpose:** Verify text generation with automatic validation

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 5.1 | Navigate to Workspace (/workspace) | Workspace page displayed | - | [ ] |
| 5.2 | Select "Summer Launch" campaign | Campaign selected, theme shown | - | [ ] |
| 5.3 | Select "Text Copy" content type | Text option highlighted | - | [ ] |
| 5.4 | Enter prompt: "Write a product announcement for our new AI tool" | Input accepts text | - | [ ] |
| 5.5 | Set variants to 3 | Dropdown shows 3 | - | [ ] |
| 5.6 | Click "Generate & Validate" | Loading spinner appears | `POST /api/text/generate` | [ ] |
| 5.7 | Wait for generation | 3 text variants displayed | Response: 201 Created | [ ] |
| 5.8 | Observe validation | Each variant shows brand score (0-100) | `POST /api/validate` x3 | [ ] |
| 5.9 | Verify score colors | Green (≥80), Yellow (60-79), Red (<60) | - | [ ] |
| 5.10 | Click "Copy" on a variant | Text copied to clipboard | - | [ ] |

**Expected Logs (Server):**
```
POST /api/text/generate - 201
POST /api/validate - 200 (x3)
```

---

## Test 6: Content Generation (Images)

**Purpose:** Verify image generation

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 6.1 | In Workspace, select "Image" content type | Image option highlighted | - | [ ] |
| 6.2 | Enter prompt: "A modern tech product hero image" | Input accepts text | - | [ ] |
| 6.3 | Click "Generate & Validate" | Loading spinner (may take 10-30s) | `POST /api/images/generate` | [ ] |
| 6.4 | Wait for generation | Image variants displayed | Response: 201 Created | [ ] |
| 6.5 | Verify computation metrics | RAG similarity, quality scores shown | - | [ ] |

---

## Test 7: Content Library

**Purpose:** Verify content browsing and filtering

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 7.1 | Navigate to Content Library (/library) | Library page displayed | `GET /api/projects` | [ ] |
| 7.2 | Verify generated content appears | Text and/or images from Tests 5-6 | `GET /api/contents/:project_id` | [ ] |
| 7.3 | Filter by "Text" type | Only text content shown | - | [ ] |
| 7.4 | Filter by campaign | Only selected campaign's content | - | [ ] |
| 7.5 | Search for keyword | Matching content filtered | - | [ ] |

---

## Test 8: Settings & Brand Management

**Purpose:** Verify settings page functionality

| Step | Action | Expected Result | API Call | Pass? |
|------|--------|-----------------|----------|-------|
| 8.1 | Navigate to Settings (/settings) | Settings page displayed | `GET /api/themes` | [ ] |
| 8.2 | Verify API key display | Partial key shown (first/last 8 chars) | - | [ ] |
| 8.3 | Click "Copy" on API key | Key copied to clipboard | - | [ ] |
| 8.4 | Verify themes list | "TechCorp" theme displayed | - | [ ] |
| 8.5 | Add new theme "Casual Brand" | Theme added to list | `POST /api/themes/create` - 201 | [ ] |

---

## Test 9: Multi-Client Isolation

**Purpose:** Verify data isolation between different clients

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 9.1 | In Browser 1: Note current themes and campaigns | Record data | [ ] |
| 9.2 | Open Browser 2 (incognito) | Fresh session | [ ] |
| 9.3 | Create new account "Company B" | New API key generated | [ ] |
| 9.4 | Verify no themes/campaigns exist | Empty dashboard | [ ] |
| 9.5 | Create theme "B Brand" and campaign "B Campaign" | Created successfully | [ ] |
| 9.6 | Return to Browser 1 | Original data unchanged | [ ] |
| 9.7 | Verify "B Brand" does NOT appear | Data isolated | [ ] |

---

## Test 10: Edge Cases & Error Handling

**Purpose:** Verify graceful error handling

| Step | Action | Expected Result | Pass? |
|------|--------|-----------------|-------|
| 10.1 | Try to generate without selecting campaign | Button disabled or error shown | [ ] |
| 10.2 | Try to generate with empty prompt | Button disabled | [ ] |
| 10.3 | Stop backend, try to generate | Network error displayed | [ ] |
| 10.4 | Restart backend, retry | Works normally | [ ] |
| 10.5 | Enter very long prompt (1000+ chars) | Handles gracefully | [ ] |

---

## Test Summary

| Test Suite | Passed | Failed | Notes |
|------------|--------|--------|-------|
| 1. Account Creation | /5 | | |
| 2. Login | /4 | | |
| 3. Brand Setup | /8 | | |
| 4. Campaign Dashboard | /5 | | |
| 5. Text Generation | /10 | | |
| 6. Image Generation | /5 | | |
| 7. Content Library | /5 | | |
| 8. Settings | /5 | | |
| 9. Multi-Client | /7 | | |
| 10. Edge Cases | /5 | | |
| **TOTAL** | **/59** | | |

---

## Running Against Cloud-Deployed API

To run E2E tests against the GCP-deployed Ditto API:

1. Update `vite.config.ts` to point to the GCP service URL:
   ```typescript
   proxy: {
     '/api': {
       target: 'https://team-ditto-1023593524929.europe-west1.run.app',
       changeOrigin: true,
     },
   },
   ```

2. Run automated tests with the `USE_GCP` flag:
   ```bash
   USE_GCP=true npm run test:e2e
   ```
   This skips starting the local backend server (since we're using GCP).

3. Or for manual testing, start the client and follow the checklist:
   ```bash
   npm run dev
   ```

> **Warning:** E2E tests create real data in the database. Use a staging/test Supabase project rather than production.

---

## Notes

- Automated Playwright tests now cover the critical user flows (authentication, brand setup, content generation)
- Manual tests remain useful for edge cases and exploratory testing
- Tests use real Supabase and Vertex AI - use staging/test data
