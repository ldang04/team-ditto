# Team Ditto - AI-Powered Content Generation API

An intelligent API service that generates and validates marketing content using AI. Built with TypeScript, Express, Supabase, and Google Cloud Vertex AI.

## Table of Contents
- [Getting Started](#getting-started)
- [Client Application](#client-application)
- [API Documentation](#api-documentation)
- [Style Checker](#style-checker)
- [Tools & Testing](#tools--testing)
- [Bugs & Challenges Encountered](#bugs--challenges-encountered)
- [AI Citations](#ai-citations)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)
- **Supabase Account** - For database and authentication
- **Google Cloud Platform Account** - With Vertex AI API enabled

### Environment Setup

1. **Clone the repository:**
 ```bash
 git clone https://github.com/ldang04/team-ditto.git
 cd team-ditto
 ```

2. **Install dependencies:**
 ```bash
 npm install
 ```

3. **Create environment file:**
 
 Create a `.env` file in the project root with the following variables:
 ```env
 # Supabase Configuration
 SUPABASE_URL=your-supabase-project-url
 SUPABASE_SERVICE_KEY=your-supabase-service-role-key
 
 # Google Cloud Platform Configuration
 GCP_PROJECT_ID=your-gcp-project-id
 VERTEX_MODEL_TEXT=gemini-2.5-flash-lite
 
 # Server Configuration (optional)
 PORT=3000
 ```

4. **Set up Google Cloud credentials:**
 
 Place your GCP service account JSON file in the project root as `gcp-service-account.json` (this file is gitignored for security).
 
 Alternatively, authenticate using:
 ```bash
 gcloud auth application-default login
 ```

5. **Set up Supabase database:**
 
 Your Supabase database should have the following tables:
 - `clients` - Client organizations
 - `api_keys` - API keys for authentication
 - `projects` - Marketing projects
 - `themes` - Brand themes
 - `contents` - Generated content
 - `embeddings` - Vector embeddings for content validation
 
 See the Supabase schema in your project dashboard or contact your team for the schema file.

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

This creates compiled JavaScript files in the `dist/` directory.

### Building and Testing with CI/CD

This project uses **GitHub Actions** for continuous integration. The CI workflow automatically runs on every push and pull request.

#### How CI Works

The CI workflow (`.github/workflows/ci.yml`) automatically:

1. **Checks out your code** from the repository
2. **Sets up Node.js** (version 20) with npm caching
3. **Authenticates to Google Cloud** for Vertex AI access
4. **Installs dependencies** using `npm ci` (clean install)
5. **Type checks** TypeScript code (`npm run typecheck`)
6. **Builds** the TypeScript code (`npm run build`)
7. **Runs ESLint** for style checking (`npm run lint`)
8. **Runs static analysis** for bug detection (`npm run analyze`)
9. **Runs unit tests** with coverage (`npm run test:unit`)
10. **Uploads artifacts** (test results, coverage reports, analysis reports)

#### Viewing CI Results

1. Go to your GitHub repository
2. Click the **"Actions"** tab
3. Select a workflow run to see detailed results
4. Click on individual steps to see logs
5. Download artifacts to view test reports, coverage, and static analysis results

#### Running CI Steps Locally

To simulate what CI does locally, run these commands in order:

```bash
# Install dependencies (clean install, like CI)
npm ci

# Type checking
npm run typecheck

# Build
npm run build

# Style checking
npm run lint

# Static analysis
npm run analyze

# Unit tests with coverage
npm run test:unit
```

#### CI Configuration Files

All configuration files required for CI are included in the repository:

- `.github/workflows/ci.yml` - CI workflow definition
- `.github/workflows/deploy.yml` - CD workflow for Cloud Run deployment
- `jest.config.ts` - Jest test configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint configuration
- `package.json` - Dependencies and scripts

#### Required GitHub Secrets for CI

The CI workflow requires these secrets to be set in GitHub (Settings → Secrets and variables → Actions):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key
- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GCP_SERVICE_ACCOUNT_KEY` - GCP service account JSON key for Vertex AI access

**Note:** Without these secrets, CI will fail when running tests that require database or AI services.

#### What CI Tests

The CI workflow runs:
- ✅ TypeScript type checking
- ✅ Code compilation (build)
- ✅ ESLint style checking
- ✅ Static analysis (bug detection)
- ✅ Unit tests with coverage

**Note:** API tests (Postman/Newman) are not run in CI as they require a running server. Run them manually using `npm run api:test` after starting the server locally.

### Run the Application

#### Development Mode (with auto-reload):
```bash
npm start
```

This runs the server using `ts-node-dev` which automatically reloads on file changes.

#### Production Mode:
```bash
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` (or the PORT specified in your `.env` file).

#### Verify the server is running:
```bash
curl http://localhost:3000/api/vertex-test
```

### Run Tests

#### Unit Tests:
```bash
# Run all unit tests
npm test

# Run with coverage report
npm run test:unit

# Run with JUnit XML output (for CI/CD)
npm run test:unit:junit
```

#### API Tests:
**Note:** The server must be running for API tests to work.

In one terminal:
```bash
npm start
```

In another terminal:
```bash
npm run api:test
```

**Logging Verification:** 
Our service uses the Winston logger to record both informational and error logs for every API request.

**How it works:**
1. All incoming API requests are logged - calls logger.info() with the request method, URL, and payload.
2. Controller-level errors are logged using logger.error() along with the stack trace.
3. Winston writes logs to both the console (for live debugging) and to persistent log files under the `logs/` directory.

**File output (persistent):**
1. `logs/combined.log` → contains all info, warn, and error logs.
2. `logs/error.log` → contains only error level logs for easier debugging.

**API tests trigger logging in the server. To verify logging works:**
1. Watch the first terminal (where `npm start` is running) during API tests
2. You should see `console.log` output for errors and debugging
3. Each endpoint call generates log entries showing the service is functioning
4. Every successful endpoint call → recorded in `combined.log`.
5. Every failed or exception-throwing call → recorded in both `combined.log` and `error.log`.


#### Generate All Reports:
```bash
npm run reports:all
```

This generates:
- Unit test results
- Coverage reports
- API test results
- Coverage summary

### Project Structure

```
team-ditto/
├── src/ # API service source code
│ ├── controllers/ # Request handlers
│ ├── models/ # Database models
│ ├── routes/ # API routes
│ ├── services/ # Business logic (e.g., EmbeddingService)
│ ├── middleware/ # Authentication middleware
│ ├── config/ # Configuration (Supabase client)
│ ├── types/ # TypeScript type definitions
│ ├── utils/ # Utility functions
│ ├── app.ts # Express app configuration
│ └── index.ts # Server entry point
├── client/ # Client application (React)
│ ├── src/ # Client source code
│ ├── package.json # Client dependencies
│ └── README.md # Client documentation
├── tests/ # Test files
├── postman/ # Postman collection and environment
├── reports/ # Generated test reports
├── dist/ # Compiled JavaScript (gitignored)
├── coverage/ # Coverage reports (gitignored)
├── __mocks__/ # Jest mocks for testing
├── package.json # Dependencies and scripts
├── tsconfig.json # TypeScript configuration
├── jest.config.ts # Jest configuration
├── eslint.config.js # ESLint configuration
└── README.md # This file
```

---

## Client Application

### Where to Find the Client Code

The client application code is located in the `client/` directory of this repository. This is a React-based web application that provides a user interface for interacting with the Ditto Content API.

### What the Client Does

**LinkLaunch** is a LinkedIn marketing campaign builder that helps professionals create engaging LinkedIn posts with AI-generated text and images. The client application:

- Provides a user-friendly interface for creating and managing marketing campaigns
- Generates LinkedIn-optimized content using the Ditto Content API
- Validates content against brand guidelines
- Manages drafts and content libraries
- Displays LinkedIn-style previews of generated content

For detailed information about the client's features and functionality, see the [client README](client/README.md).

### Building and Running the Client

#### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Ditto API service** running (either locally at `http://localhost:3000` or deployed)

#### Installation

1. Navigate to the client directory:
 ```bash
 cd client
 ```

2. Install dependencies:
 ```bash
 npm install
 ```

#### Running the Client

**Development Mode:**

1. Start the Ditto API service (from project root):
 ```bash
 npm start
 ```

2. Start the client (from `client/` directory):
 ```bash
 npm run dev
 ```

3. Open `http://localhost:5173` in your browser

**Production Build:**

```bash
cd client
npm run build
```

The production build will be in the `client/dist/` directory.

### Connecting Client Instances to the Service

#### Local Development

By default, the client is configured to connect to a locally running API service at `http://localhost:3000`. The client uses a Vite proxy configuration (in `client/vite.config.ts`) to forward API requests to the backend.

#### Connecting to a Cloud-Deployed API

To connect a client instance to a cloud-deployed API service, modify `client/vite.config.ts`:

```typescript
server: {
 proxy: {
 '/api': {
 target: 'https://your-gcp-service-url.run.app',
 changeOrigin: true,
 },
 },
}
```

#### Multiple Client Instances

**You can run multiple client instances simultaneously.** Each client instance:

- Can run on any local machine (does not need to run in the cloud)
- Must have its own unique API key (obtained via `/api/clients/create`)
- Stores its API key in browser localStorage
- Can connect to the same API service instance

**Example:** You can run:
- Client instance 1 on `localhost:5173` (API key: `key-abc-123`)
- Client instance 2 on `localhost:5174` (API key: `key-xyz-789`)
- Client instance 3 on a different machine (API key: `key-def-456`)

All three can connect to the same API service running at `localhost:3000` or a cloud deployment.

### How the Service Handles Multiple Client Instances

The Ditto API service is designed to handle multiple client instances running simultaneously. Here's how it works:

#### Client Identification via API Keys

1. **Each client instance gets a unique API key:**
 - When a client first starts, it calls `/api/clients/create` (no authentication required)
 - The service creates a new client record in the database and generates a unique API key
 - The API key is returned to the client and stored in browser localStorage

2. **API key maps to client_id:**
 - The service maintains an `api_keys` table that maps API keys to `client_id`
 - Every authenticated request includes the API key in the `Authorization: Bearer <api_key>` header
 - The service's authentication middleware looks up the API key to determine the `client_id`

3. **Data isolation by client_id:**
 - All database tables (projects, themes, contents, etc.) include a `client_id` column
 - Every query filters results by `client_id` to ensure data isolation
 - Client A's projects, themes, and content are completely separate from Client B's data

#### Multi-Client Architecture

```
┌─────────────────┐
│ Client Instance 1 │ (API Key: key-abc-123)
│ localhost:5173 │
└────────┬──────────┘
 │
 │ Authorization: Bearer key-abc-123
 │
 ▼
┌─────────────────────────────────────┐
│ Ditto API Service │
│ localhost:3000 │
│ │
│ ┌──────────────────────────────┐ │
│ │ Authentication Middleware │ │
│ │ - Validates API key │ │
│ │ - Extracts client_id │ │
│ └──────────────┬─────────────────┘ │
│ │ │
│ ┌──────────────▼─────────────────┐ │
│ │ Database Queries │ │
│ │ - Filter by client_id │ │
│ │ - Data isolation enforced │ │
│ └────────────────────────────────┘ │
└─────────────────────────────────────┘
 ▲
 │
 │ Authorization: Bearer key-xyz-789
 │
┌────────┴──────────┐
│ Client Instance 2 │ (API Key: key-xyz-789)
│ localhost:5174 │
└───────────────────┘
```

#### How the Service Tells Clients Apart

The service distinguishes between clients using a three-layer identification system:

1. **API Key Authentication:**
 - Each request includes `Authorization: Bearer <api_key>` header
 - The service validates the API key against the `api_keys` table
 - Invalid or missing API keys return `401 Unauthorized` or `403 Forbidden`

2. **Client ID Extraction:**
 - Valid API keys map to a unique `client_id` in the database
 - The authentication middleware extracts and attaches `client_id` to the request object
 - All subsequent database operations use this `client_id`

3. **Database-Level Isolation:**
 - Every table includes a `client_id` foreign key
 - All SELECT queries include `WHERE client_id = ?` filters
 - All INSERT operations automatically include the authenticated `client_id`
 - This ensures complete data isolation between clients

**Example Flow:**

```typescript
// Client Instance 1 makes request
GET /api/projects
Authorization: Bearer key-abc-123

// Service authentication middleware:
1. Validates key-abc-123 → finds client_id = "client-1"
2. Attaches client_id to request object

// Database query:
SELECT * FROM projects WHERE client_id = 'client-1'
// Returns only Client 1's projects

// Client Instance 2 makes request
GET /api/projects
Authorization: Bearer key-xyz-789

// Service authentication middleware:
1. Validates key-xyz-789 → finds client_id = "client-2"
2. Attaches client_id to request object

// Database query:
SELECT * FROM projects WHERE client_id = 'client-2'
// Returns only Client 2's projects (completely separate data)
```

This architecture ensures that:
- Multiple client instances can run simultaneously without conflicts
- Each client only sees and can only access their own data
- The service can handle unlimited concurrent client connections
- Client instances can run on any machine (local or cloud) and connect to the same service

---

## API Documentation

### Authentication

**Most endpoints require API key authentication.** Include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

**How to get an API key:**
1. First, call `/api/clients/create` (no auth required) to create a client
2. You'll receive an API key in the response - **save it immediately!**
3. Use that API key in the `Authorization` header for all other endpoints

### Endpoints Overview

**Status Code Format:** `HTTP_CODE (description)` - **Status:** for success codes, **Errors:** for error codes

#### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/clients/create` | **Start here!** Create a new client and get an API key<br/>**Body:** `{"name": "string"}`<br/>**Returns:** `{success, data: {client_id, api_key}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing name), 500 (server error) |
| GET | `/api/vertex-test` | Test Vertex AI connection<br/>**No parameters required**<br/>**Returns:** `{success, data: "AI response", message}`<br/>**Status:** 200 (success), **Errors:** 500 (Vertex AI connection failed) |

#### Protected Endpoints (Require Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Projects** |||
| POST | `/api/projects/create` | Create a new project<br/>**Required:** `name`<br/>**Optional:** `description`, `goals`, `customer_type`, `theme_id`<br/>**Returns:** `{success, data: {id, name, description, goals, customer_type, theme_id, created_at, client_id}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing name), 401 (no auth), 403 (invalid auth), 500 (server error) |
| GET | `/api/projects` | List all projects for authenticated client<br/>**No parameters required**<br/>**Returns:** `{success, data: [{project objects}], message}`<br/>**Status:** 200 (success), **Errors:** 401 (no auth), 403 (invalid auth), 500 (server error) |
| PUT | `/api/projects/:id` | Update a project<br/>**Path:** `:id`<br/>**Body:** Any of `name`, `description`, `goals`, `customer_type`, `theme_id`<br/>**Returns:** `{success, data: {updated project object}, message}`<br/>**Status:** 200 (success), **Errors:** 400 (invalid data), 401 (no auth), 403 (invalid auth), 404 (project not found), 500 (server error) |
| **Themes** |||
| POST | `/api/themes/create` | Create a new brand theme<br/>**Required:** `name`, `tags[]` (array, must have at least one tag)<br/>**Optional:** `inspirations[]` (array), `project_id`<br/>**Returns:** `{success, data: {id, name, tags, inspirations, created_at, client_id, ...}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing name or tags), 401 (no auth), 403 (invalid auth), 500 (server error) |
| GET | `/api/themes` | List all themes for authenticated client<br/>**No parameters required**<br/>**Returns:** `{success, data: [{theme objects}], message}`<br/>**Status:** 200 (success), **Errors:** 401 (no auth), 403 (invalid auth), 500 (server error) |
| **Contents** |||
| GET | `/api/contents/:project_id` | List all content for a project<br/>**Path:** `:project_id`<br/>**Returns:** `{success, data: [{id, project_id, media_type, media_url, text_content, created_at}], message}`<br/>**Status:** 200 (success), **Errors:** 401 (no auth), 403 (invalid auth), 404 (project not found), 500 (server error) |
| **Text Generation** |||
| POST | `/api/text/generate` | Generate text content using AI<br/>**Required:** `project_id`, `prompt`<br/>**Optional:** `style_preferences` (default: {}), `target_audience` (default: "general"), `variantCount` (default: 3), `media_type` (default: "text")<br/>**Returns:** `{success, data: {variants: [{content_id, generated_content}], project_id, media_type, variant_count, timestamp}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing project_id/prompt), 401 (no auth), 403 (invalid auth), 404 (project/theme not found), 500 (AI generation failed) |
| **Image Generation** |||
| POST | `/api/images/generate` | Generate images using AI with RAG<br/>**Required:** `project_id`, `prompt`<br/>**Optional:** `style_preferences` (default: {}), `target_audience` (default: "general"), `variantCount` (default: 3, range: 1-10), `aspectRatio` (default: "1:1"), `input_images` (array of base64 images), `overlay_text` (string)<br/>**Returns:** `{success, data: {variants: [{content_id, image_url, generated_content}], project_id, variant_count, timestamp}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing project_id/prompt), 401 (no auth), 403 (invalid auth), 404 (project/theme not found), 500 (AI generation failed) |
| **Content Validation** |||
| POST | `/api/validate` | Validate content against brand guidelines<br/>**Either:** `content_id` **OR** `content` + `project_id`<br/>**Prerequisites:** Project must have a theme linked AND customer_type must be set (not null)<br/>**Returns:** `{success, data: {validation: {brand_consistency_score, quality_score, overall_score, passes_validation, strengths, issues, recommendations, summary, similarity_details}}, message}`<br/>**Status:** 200 (success), **Errors:** 400 (missing parameters), 401 (no auth), 403 (invalid auth), 404 (content/project/theme not found), 500 (validation failed) |
| **Content Ranking** |||
| POST | `/api/rank` | Rank content items by brand alignment and quality<br/>**Either:** `project_id` **OR** `content_ids[]` (array of content IDs)<br/>**Optional:** `limit` (number)<br/>**Returns:** `{success, data: {ranked_content: [{content_id, rank, brand_consistency_score, quality_score, overall_score, recommendation}], summary: {total_ranked, average_scores}}, message}`<br/>**Status:** 200 (success), **Errors:** 400 (missing project_id or content_ids), 401 (no auth), 403 (invalid auth), 404 (project/content not found), 500 (ranking failed) |

#### Quick Status Code Reference
- **200**: Success (GET, PUT, POST operations completed successfully)
- **201**: Created (POST operations that create new resources)
- **400**: Bad request (missing required fields, invalid data)
- **401**: Unauthorized (missing API key)
- **403**: Forbidden (invalid API key)
- **404**: Not found (resource doesn't exist)
- **500**: Internal server error (server/configuration issue)

### Endpoint Ordering Requirements

**IMPORTANT:** Some endpoints must be called in a specific order to work correctly:

#### Required Setup Sequence

1. **Create Client** (`POST /api/clients/create`) - **MUST BE FIRST**
 - No authentication required
 - Returns API key needed for all subsequent calls
 - **Save the API key immediately** - it's only shown once

2. **Create Theme** (`POST /api/themes/create`) - **BEFORE creating projects**
 - Required for projects that will use validation or generation
 - Must include `name` and `tags` array (non-empty)
 - Returns `theme_id` needed for project creation

3. **Create Project** (`POST /api/projects/create`) - **AFTER theme creation**
 - Must include `theme_id` (from step 2) for validation/generation to work
 - Must include `customer_type` (not null) for validation to work
 - Returns `project_id` needed for content operations

4. **Generate/Validate/Rank Content** - **AFTER project setup**
 - Requires project with `theme_id` and `customer_type` set
 - Can be called in any order once project is properly configured
 - `/api/text/generate` and `/api/images/generate` are **independent** - neither requires the other
 - Both generation endpoints use RAG to retrieve existing project content for context (works with any existing content, or theme-only if none exists)
 - `/api/rank` requires content to exist (either via `project_id` or `content_ids`)

#### Endpoints That Must NOT Be Called in Certain Orders

- **DO NOT** call `/api/validate` before creating a theme and linking it to a project
- **DO NOT** call `/api/text/generate` or `/api/images/generate` before project has `theme_id`
- **DO NOT** call `/api/rank` with `project_id` before any content has been generated for that project
- **DO NOT** call `/api/themes/create` without providing a non-empty `tags` array

### Proper Setup Sequence for Validation

**IMPORTANT:** The `/api/validate` endpoint requires specific project setup to work correctly:

1. **Create a client** (get API key)
2. **Create a theme** (with inspirations for brand guidelines)
3. **Create a project** with:
 - `theme_id` (link to the theme)
 - `customer_type` (must not be null - this is critical!)
4. **Now validation will work**

**Why this matters:** The validation system uses the theme's inspirations and the project's customer_type to assess brand consistency. Without these, the system cannot perform proper validation.

### Quick Reference: Validation Endpoint

**Endpoint:** `POST /api/validate`
**Authentication:** Required (Bearer token)
**Prerequisites:** Project must have `theme_id` AND `customer_type` (not null)

**Request Options:**
- Option A: `{"content_id": "existing-content-id"}`
- Option B: `{"content": "text to validate", "project_id": "project-id"}`

**Response:** Returns brand consistency score, quality score, recommendations, and detailed similarity analysis.

### Example API Calls

#### 1. Create a Client
```bash
curl -X POST http://localhost:3000/api/clients/create \
 -H "Content-Type: application/json" \
 -d '{"name": "My Company"}'
```

Response:
```json
{
 "success": true,
 "data": {
 "client_id": "abc-123",
 "api_key": "your-api-key-here"
 },
 "message": "Client created successfully"
}
```

**IMPORTANT:** Save the API key - it's only shown once!

#### 2. Create a Theme (First - needed for project)
```bash
curl -X POST http://localhost:3000/api/themes/create \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "name": "Modern Tech",
 "tags": ["modern", "professional"],
 "inspirations": ["Apple", "Google"]
 }'
```

**Note:** `tags` is required and must be a non-empty array.

#### 3. Create a Project (with theme_id and customer_type)
```bash
curl -X POST http://localhost:3000/api/projects/create \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "name": "Summer Campaign",
 "description": "Product launch campaign",
 "goals": "Increase awareness",
 "customer_type": "Tech professionals",
 "theme_id": "your-theme-id-from-step-2"
 }'
```

#### 4. Generate Text Content
```bash
curl -X POST http://localhost:3000/api/text/generate \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "project_id": "your-project-id",
 "prompt": "Create a product announcement",
 "variantCount": 3
 }'
```

#### 5. Generate Image Content
```bash
curl -X POST http://localhost:3000/api/images/generate \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "project_id": "your-project-id",
 "prompt": "Professional product image",
 "variantCount": 2,
 "aspectRatio": "16:9"
 }'
```

#### 6. Rank Content
```bash
curl -X POST http://localhost:3000/api/rank \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "project_id": "your-project-id",
 "limit": 10
 }'
```

#### 7. Validate Content
```bash
curl -X POST http://localhost:3000/api/validate \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "content": "Our innovative tech solution provides modern features for professionals",
 "project_id": "your-project-id"
 }'
```

**Note:** This will only work if your project has both a `theme_id` and `customer_type` set (not null).

### Troubleshooting Validation Issues

**Problem:** Getting 500 error when calling `/api/validate`
**Solution:** Ensure your project has:
- `theme_id` is set (not null)
- `customer_type` is set (not null)

**Problem:** Getting 404 "Theme not found" 

**Solution:** Link your project to a theme using `theme_id`


**Problem:** Getting 400 "Must provide either content_id OR (content + project_id)"

**Solution:** Provide either:
- `content_id` (to validate existing content)
- OR both `content` and `project_id` (to validate new text)

---

## Style Checker

This project utilizes ESLint as a code style checker to ensure consistency amongst the Typscript code, and to find any bugs.

The configuration for this service uses:

- ESLint v9 (flat-config format)
- TypeScript-ESLint for TypeScript support
- @eslint/js for base JavaScript rules
- Custom project rules defined in eslint.config.js


To run the style checker, first of course make sure that you have installed all dependencies:

`npm install`

Then, if you added ESLint later, you can install the required packages throught the following command:

`npm install --save-dev eslint typescript-eslint @eslint/js`

To run the style checker, use the following command:

`npm run lint`

To generate an HTML lint report run this command:

`npm run lint:report`

You can find the generated report in the `reports` folder in the root level directory, with the HTML file named, `eslint-report.html`.

The specific rule set that we are using is named in the config file, but to list it here, we use the Base JS recommended rules and recommended Typescript configs. Here is a [link](https://google.github.io/styleguide/jsguide.html) that was referred to every now and then when configuring our style rule set.
And here is a [link](https://google.github.io/styleguide/tsguide.html) for documentation we consulted when reviewing some Typescript rules sets


An example of the report generated is shown below. This screenshot was taken as of 10/23/25. It shows how the current codebase came back clean with our rules implemented with the style checker:
![sc of style checker report](./images/checkstyle_report_10-23.png)

If curious about the documentation that was used to understand the style checker, check out this [link!](https://eslint.org/docs/latest/use/getting-started)


## Tools & Testing

This project includes a comprehensive testing infrastructure with multiple tools for unit testing, API testing, coverage reporting, and CI/CD integration via GitHub Actions.

### Core Testing Framework

#### **Jest** - Complete Testing Framework
- **Purpose**: Core testing framework that handles ALL types of testing
- **Usage**: `npm test`
- **Output**: Test results in terminal with pass/fail status
- **What it provides**: 
 - **Unit Testing**: `describe()`, `it()`, `expect()` functions
 - **API Testing**: Works with supertest for HTTP requests
 - **Function Testing**: Test individual functions and methods
 - **Coverage Reporting**: Built-in coverage measurement
 - **Mocking**: Mock functions, modules, and dependencies

#### **ts-jest** - TypeScript Compiler
- **Purpose**: Compiles TypeScript test files without manual compilation
- **Usage**: Automatically configured in `jest.config.ts`
- **Output**: Transparent TypeScript compilation for tests
- **What it provides**: Seamless TypeScript support in test files

#### **@types/jest** - TypeScript Definitions
- **Purpose**: Provides IntelliSense and type checking for Jest functions
- **Usage**: Automatically loaded
- **Output**: Autocomplete and type safety for Jest functions
- **What it provides**: TypeScript support for `describe`, `it`, `expect`, etc.

### API Testing Tools

#### **supertest** - HTTP Request Testing
- **Purpose**: Simulates HTTP requests to Express app without starting a real server
- **Usage**: Import in test files: `import request from 'supertest'`
- **Output**: HTTP request/response testing with status codes and body validation
- **What it provides**: `request(app).get('/endpoint').expect(200)` syntax

#### **@types/supertest** - TypeScript Definitions
- **Purpose**: Provides IntelliSense for supertest functions
- **Usage**: Automatically loaded
- **Output**: Autocomplete for `request()`, `.get()`, `.post()`, `.expect()`
- **What it provides**: TypeScript support for HTTP testing

### Coverage & Reporting Tools

#### **jest-junit** - JUnit XML Reports
- **Purpose**: Generates XML reports for CI/CD systems (Jenkins, GitHub Actions)
- **Usage**: `npm run test:unit:junit`
- **Output**: `reports/jest-junit.xml` - Standard XML format for CI integration
- **What it provides**: Test results, timing, and metadata in XML format

#### **Jest Coverage** - Built-in Coverage Measurement
- **Purpose**: Measures how much of your code was executed by tests (built into Jest)
- **Usage**: `npm run test:unit` (includes coverage)
- **Output**: Coverage metrics and HTML reports
- **What it provides**: Statement, branch, function, and line coverage percentages

**NOTE:** You can find the HTML report generated by the command by looking into the `coverage` folder and finding the `index.html` file.

Here is a screenshot of the command's output in the terminal after while our service is running (Taken 10/23/25):
![terminal branch coverage output](./images/terminalbranchcov10-23.png)

Here is a screenshot of the HTML report that is generated when checking branch coverage tests (Taken 10/23/25):
![branch coverage report](./images/branchcov_report_10_23.png)


#### **source-map-support** - TypeScript Stack Traces
- **Purpose**: Maps coverage and stack traces correctly back to TypeScript line numbers
- **Usage**: Automatically configured
- **Output**: Better error messages showing TypeScript lines instead of compiled JS
- **What it provides**: Accurate error reporting and debugging

### API Testing with Postman

#### **newman** - Postman Collection Runner
- **Purpose**: Command-line runner for Postman collections (runs API tests automatically)
- **Usage**: `npm run api:test`
- **Output**: API test results in terminal with pass/fail status
- **What it provides**: Automated API endpoint testing without manual Postman usage

#### **newman-reporter-htmlextra** - Beautiful HTML Reports
- **Purpose**: Generates beautiful HTML reports for API test runs
- **Usage**: Automatically configured with newman
- **Output**: `reports/postman-report.html` - Interactive HTML report
- **What it provides**: Visual API test results with detailed request/response information

**NOTE:** Test Dependencies Are Critical, the Postman tests must run in correct order

### Available Commands

```bash
# Basic testing
npm test # Run all tests
npm run test:unit # Run tests with coverage
npm run test:unit:junit # Run tests with coverage + JUnit XML

# API testing
npm run api:test # Run Postman collections

# Full reporting
npm run reports:all # Generate all reports (tests + coverage + API)
npm run coverage:summary # Generate coverage summary
```

### Generated Reports

| Report | Location | Purpose |
|--------|----------|---------|
| **HTML Coverage Report** | `coverage/index.html` | Interactive coverage visualization |
| **JUnit XML** | `reports/jest-junit.xml` | CI/CD integration |
| **API Test Report** | `reports/postman-report.html` | Postman test results |


## Bugs & Challenges Encountered

The following lists some bugs and errors that we ran into. This section serves as:

- When first getting the API to run, we ran into some trouble. It seemed as though `app.listen` was not being hit and that there was this trend that as one updated the `app.ts` file, the run commands stopped running. With some further investigation, such as guidance from AI tools with prompts asking for help to debug, and documentation reading, we were able to solve this issue.

- There was a time when we had issue with figuring out how to protect our API keys, but that was a quick fix by modifying the `/client/create` endpoint.

- During testing, in order to ensure the project was demoable, the `/generate` endpoint was hanging and not returning a response code. We found that content was being generated, despite the hanging of the endpoint. We fixed this accordingly and ensure that the endpoint worked (i.e. returning a response) with further testting.

#### Postman Test Debugging

- Our Postman API tests were failing with 13 errors initially, then we reduced it to 9 errors, and finally down to 2 errors. Here is a breakdown of these error and our debugging of them:

- `/api/generate` and `/api/validate` endpoints were returning 404 errors
- Project creation was failing with 500 errors
- Tests were failing due to missing or invalid project IDs
- There were JSON parsing errors in request bodies
- There were environment variable management issues

We found that the issues were related to database schema requirements, test execution order issue, and missing dependencies. We solved these errors by fixing JSON escaping, fixing environment variables, fixing project creation, creating a dedicated test project, and updating test dependencies.

---

## AI Citations

### AI Citation for JSDoc Documentation, Content Generation Prompts, and AI Integration

- JSDoc Documentation: used AI to generate API documentation for the /generate endpoint ; highlighted the code in cursor and asked it to generate a JSDoc description based on the given parameters / outputs 
- Content generation prompts: used Cursor in-line prompting to create a prompt template for context-aware prompts that incorporates the project data and user requirements. Prompted along the lines of: "Based on the user-inputted data, generate a context-aware prompt that produces relevant marketing content. Incorporate the exact variables highlighted in the prompt"
- AI integration: integrated with Google Cloud Vertex AI for actual content generation. Used GCP credits supplied in class.


### AI Citation for Style Checker:

The "lint" lines in the package.json files were created with the help of ChatGPT and documentation reading. The file `eslint.config.js`, which is where all the ESLint settings are, is also cited in the file and was created with the help and guidance of ChatGPT and online documentation. Prompts given were just that of the nature where we explained what we were hoping to achieve with specific settings and asking how we could go about implementing this.

### AI Citation for Postman API Testing Configuration:

This sections of the project was done with the help of Cursor. A prompt like "modify this file to support proper theme endpoint injection for correct testing usage," was used to generate guidance and code.

### AI Citation for Comments:

There are some comments that were done with the assistance of Copilot. Prompts were of the nature asking for assistance in commenting and providing descriptions for functions and files.

### AI Citation for Content Validation Implementation:
- **Files:** `src/controllers/Computation.ts` (validate function), `src/routes/computationRoutes.ts`
- **Use Case:** Used Cursor to add error handling the `/api/validate` endpoint that compares generated content against brand themes using cosine similarity calculations that i wrote
- **What AI Generated:** 
 - Error handling for edge cases (missing params, invalid IDs)
 - JSDoc comments for the validate function

### AI Citation for API Testing Enhancements:
- **Files:** `postman/collection.json`, `README.md`
- **Use Case:** Used Cursor to expand API test coverage from 25 to 34+ tests
- **What AI Generated:**
 - 4 data persistence tests (create → read → update → read)
 - 5 multi-client isolation tests with separate API keys
 - Collection-level prerequest scripts for logging documentation
 - README section explaining how to verify logging during API tests

### AI Citation for Documentation:
- **Files:** `README.md` (API Documentation section)
- **Use Case:** Enhanced API documentation clarity
- **Prompts:** "Clarify that /api/clients/create is a public endpoint used to obtain API keys"
- **What AI Generated:** "How to get an API key" section with step-by-step instructions

### AI Citation for Client Application (LinkLaunch):
- **Files:** `client/src/pages/*.tsx`, `client/src/components/*.tsx`, `client/src/types/index.ts`, `client/README.md`, `README.md` (Client Application section)
- **Use Case:** Built the LinkLaunch React client application with Cursor AI assistance (component scaffolding + code-complete)
- **What AI Generated:** React components for LinkedIn post generation, validation, and preview; content grouping logic; validation UI with metrics; API integration hooks; TypeScript types; formatting client documentation and diagrams (including multi-client architecture)
# Team Ditto - AI-Powered Content Generation API

An intelligent API service that generates and validates marketing content using AI. Built with TypeScript, Express, Supabase, and Google Cloud Vertex AI.

## Table of Contents
- [Getting Started](#getting-started)
- [Client Application](#client-application)
- [API Documentation](#api-documentation)
- [Style Checker](#style-checker)
- [Tools & Testing](#tools--testing)
- [Bugs & Challenges Encountered](#bugs--challenges-encountered)
- [AI Citations](#ai-citations)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed and configured:

- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)
- **Supabase Account** - For database and authentication
- **Google Cloud Platform Account** - With Vertex AI API enabled

### Environment Setup

1. **Clone the repository:**
 ```bash
 git clone https://github.com/ldang04/team-ditto.git
 cd team-ditto
 ```

2. **Install dependencies:**
 ```bash
 npm install
 ```

3. **Create environment file:**
 
 Create a `.env` file in the project root with the following variables:
 ```env
 # Supabase Configuration
 SUPABASE_URL=your-supabase-project-url
 SUPABASE_SERVICE_KEY=your-supabase-service-role-key
 
 # Google Cloud Platform Configuration
 GCP_PROJECT_ID=your-gcp-project-id
 VERTEX_MODEL_TEXT=gemini-2.5-flash-lite
 
 # Server Configuration (optional)
 PORT=3000
 ```

4. **Set up Google Cloud credentials:**
 
 Place your GCP service account JSON file in the project root as `gcp-service-account.json` (this file is gitignored for security).
 
 Alternatively, authenticate using:
 ```bash
 gcloud auth application-default login
 ```

5. **Set up Supabase database:**
 
 Your Supabase database should have the following tables:
 - `clients` - Client organizations
 - `api_keys` - API keys for authentication
 - `projects` - Marketing projects
 - `themes` - Brand themes
 - `contents` - Generated content
 - `embeddings` - Vector embeddings for content validation
 
 See the Supabase schema in your project dashboard or contact your team for the schema file.

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

This creates compiled JavaScript files in the `dist/` directory.

### Building and Testing with CI/CD

This project uses **GitHub Actions** for continuous integration. The CI workflow automatically runs on every push and pull request.

#### How CI Works

The CI workflow (`.github/workflows/ci.yml`) automatically:

1. **Checks out your code** from the repository
2. **Sets up Node.js** (version 20) with npm caching
3. **Authenticates to Google Cloud** for Vertex AI access
4. **Installs dependencies** using `npm ci` (clean install)
5. **Type checks** TypeScript code (`npm run typecheck`)
6. **Builds** the TypeScript code (`npm run build`)
7. **Runs ESLint** for style checking (`npm run lint`)
8. **Runs static analysis** for bug detection (`npm run analyze`)
9. **Runs unit tests** with coverage (`npm run test:unit`)
10. **Uploads artifacts** (test results, coverage reports, analysis reports)

#### Viewing CI Results

1. Go to your GitHub repository
2. Click the **"Actions"** tab
3. Select a workflow run to see detailed results
4. Click on individual steps to see logs
5. Download artifacts to view test reports, coverage, and static analysis results

#### Running CI Steps Locally

To simulate what CI does locally, run these commands in order:

```bash
# Install dependencies (clean install, like CI)
npm ci

# Type checking
npm run typecheck

# Build
npm run build

# Style checking
npm run lint

# Static analysis
npm run analyze

# Unit tests with coverage
npm run test:unit
```

#### CI Configuration Files

All configuration files required for CI are included in the repository:

- `.github/workflows/ci.yml` - CI workflow definition
- `.github/workflows/deploy.yml` - CD workflow for Cloud Run deployment
- `jest.config.ts` - Jest test configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint configuration
- `package.json` - Dependencies and scripts

#### Required GitHub Secrets for CI

The CI workflow requires these secrets to be set in GitHub (Settings → Secrets and variables → Actions):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key
- `GCP_PROJECT_ID` - Your Google Cloud project ID
- `GCP_SERVICE_ACCOUNT_KEY` - GCP service account JSON key for Vertex AI access

**Note:** Without these secrets, CI will fail when running tests that require database or AI services.

**Also Note:** API tests (Postman/Newman) are not run in CI as they require a running server. Run them manually using `npm run api:test` after starting the server locally.

### Run the Application

#### Development Mode (with auto-reload):
```bash
npm start
```

This runs the server using `ts-node-dev` which automatically reloads on file changes.

#### Production Mode:
```bash
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` (or the PORT specified in your `.env` file).

#### Verify the server is running:
```bash
curl http://localhost:3000/api/vertex-test
```

### Run Tests

#### Unit Tests:
```bash
# Run all unit tests
npm test

# Run with coverage report
npm run test:unit

# Run with JUnit XML output (for CI/CD)
npm run test:unit:junit
```

#### API Tests:
**Note:** The server must be running for API tests to work.

In one terminal:
```bash
npm start
```

In another terminal:
```bash
npm run api:test
```

**Logging Verification:** 
Our service uses the Winston logger to record both informational and error logs for every API request.

**How it works:**
1. All incoming API requests are logged - calls logger.info() with the request method, URL, and payload.
2. Controller-level errors are logged using logger.error() along with the stack trace.
3. Winston writes logs to both the console (for live debugging) and to persistent log files under the `logs/` directory.

**File output (persistent):**
1. `logs/combined.log` → contains all info, warn, and error logs.
2. `logs/error.log` → contains only error level logs for easier debugging.

**API tests trigger logging in the server. To verify logging works:**
1. Watch the first terminal (where `npm start` is running) during API tests
2. You should see `console.log` output for errors and debugging
3. Each endpoint call generates log entries showing the service is functioning
4. Every successful endpoint call → recorded in `combined.log`.
5. Every failed or exception-throwing call → recorded in both `combined.log` and `error.log`.


#### Generate All Reports:
```bash
npm run reports:all
```

This generates:
- Unit test results
- Coverage reports
- API test results
- Coverage summary

### Project Structure

```
team-ditto/
├── src/ # API service source code
│ ├── controllers/ # Request handlers
│ ├── models/ # Database models
│ ├── routes/ # API routes
│ ├── services/ # Business logic (e.g., EmbeddingService)
│ ├── middleware/ # Authentication middleware
│ ├── config/ # Configuration (Supabase client)
│ ├── types/ # TypeScript type definitions
│ ├── utils/ # Utility functions
│ ├── app.ts # Express app configuration
│ └── index.ts # Server entry point
├── client/ # Client application (React)
│ ├── src/ # Client source code
│ ├── package.json # Client dependencies
│ └── README.md # Client documentation
├── tests/ # Test files
├── postman/ # Postman collection and environment
├── reports/ # Generated test reports
├── dist/ # Compiled JavaScript (gitignored)
├── coverage/ # Coverage reports (gitignored)
├── __mocks__/ # Jest mocks for testing
├── package.json # Dependencies and scripts
├── tsconfig.json # TypeScript configuration
├── jest.config.ts # Jest configuration
├── eslint.config.js # ESLint configuration
└── README.md # This file
```

---

## Client Application

### Where to Find the Client Code

The client application code is located in the `client/` directory of this repository. This is a React-based web application that provides a user interface for interacting with the Ditto Content API.

### What the Client Does

**LinkLaunch** is a LinkedIn marketing campaign builder that helps professionals create engaging LinkedIn posts with AI-generated text and images. The client application:

- Provides a user-friendly interface for creating and managing marketing campaigns
- Generates LinkedIn-optimized content using the Ditto Content API
- Validates content against brand guidelines
- Manages drafts and content libraries
- Displays LinkedIn-style previews of generated content

For detailed information about the client's features and functionality, see the [client README](client/README.md).

### Building and Running the Client

#### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Ditto API service** running (either locally at `http://localhost:3000` or deployed)

#### Installation

1. Navigate to the client directory:
 ```bash
 cd client
 ```

2. Install dependencies:
 ```bash
 npm install
 ```

#### Running the Client

**Development Mode:**

1. Start the Ditto API service (from project root):
 ```bash
 npm start
 ```

2. Start the client (from `client/` directory):
 ```bash
 npm run dev
 ```

3. Open `http://localhost:5173` in your browser

**Production Build:**

```bash
cd client
npm run build
```

The production build will be in the `client/dist/` directory.

### Connecting Client Instances to the Service

#### Local Development

By default, the client is configured to connect to a locally running API service at `http://localhost:3000`. The client uses a Vite proxy configuration (in `client/vite.config.ts`) to forward API requests to the backend.

#### Connecting to a Cloud-Deployed API

To connect a client instance to a cloud-deployed API service, modify `client/vite.config.ts`:

```typescript
server: {
 proxy: {
 '/api': {
 target: 'https://your-gcp-service-url.run.app',
 changeOrigin: true,
 },
 },
}
```

#### Multiple Client Instances

**You can run multiple client instances simultaneously.** Each client instance:

- Can run on any local machine (does not need to run in the cloud)
- Must have its own unique API key (obtained via `/api/clients/create`)
- Stores its API key in browser localStorage
- Can connect to the same API service instance

**Example:** You can run:
- Client instance 1 on `localhost:5173` (API key: `key-abc-123`)
- Client instance 2 on `localhost:5174` (API key: `key-xyz-789`)
- Client instance 3 on a different machine (API key: `key-def-456`)

All three can connect to the same API service running at `localhost:3000` or a cloud deployment.

### How the Service Handles Multiple Client Instances

The Ditto API service is designed to handle multiple client instances running simultaneously. Here's how it works:

#### Client Identification via API Keys

1. **Each client instance gets a unique API key:**
 - When a client first starts, it calls `/api/clients/create` (no authentication required)
 - The service creates a new client record in the database and generates a unique API key
 - The API key is returned to the client and stored in browser localStorage

2. **API key maps to client_id:**
 - The service maintains an `api_keys` table that maps API keys to `client_id`
 - Every authenticated request includes the API key in the `Authorization: Bearer <api_key>` header
 - The service's authentication middleware looks up the API key to determine the `client_id`

3. **Data isolation by client_id:**
 - All database tables (projects, themes, contents, etc.) include a `client_id` column
 - Every query filters results by `client_id` to ensure data isolation
 - Client A's projects, themes, and content are completely separate from Client B's data

#### Multi-Client Architecture

```
┌─────────────────┐
│ Client Instance 1 │ (API Key: key-abc-123)
│ localhost:5173 │
└────────┬──────────┘
 │
 │ Authorization: Bearer key-abc-123
 │
 ▼
┌─────────────────────────────────────┐
│ Ditto API Service │
│ localhost:3000 │
│ │
│ ┌──────────────────────────────┐ │
│ │ Authentication Middleware │ │
│ │ - Validates API key │ │
│ │ - Extracts client_id │ │
│ └──────────────┬─────────────────┘ │
│ │ │
│ ┌──────────────▼─────────────────┐ │
│ │ Database Queries │ │
│ │ - Filter by client_id │ │
│ │ - Data isolation enforced │ │
│ └────────────────────────────────┘ │
└─────────────────────────────────────┘
 ▲
 │
 │ Authorization: Bearer key-xyz-789
 │
┌────────┴──────────┐
│ Client Instance 2 │ (API Key: key-xyz-789)
│ localhost:5174 │
└───────────────────┘
```

#### How the Service Tells Clients Apart

The service distinguishes between clients using a three-layer identification system:

1. **API Key Authentication:**
 - Each request includes `Authorization: Bearer <api_key>` header
 - The service validates the API key against the `api_keys` table
 - Invalid or missing API keys return `401 Unauthorized` or `403 Forbidden`

2. **Client ID Extraction:**
 - Valid API keys map to a unique `client_id` in the database
 - The authentication middleware extracts and attaches `client_id` to the request object
 - All subsequent database operations use this `client_id`

3. **Database-Level Isolation:**
 - Every table includes a `client_id` foreign key
 - All SELECT queries include `WHERE client_id = ?` filters
 - All INSERT operations automatically include the authenticated `client_id`
 - This ensures complete data isolation between clients

**Example Flow:**

```typescript
// Client Instance 1 makes request
GET /api/projects
Authorization: Bearer key-abc-123

// Service authentication middleware:
1. Validates key-abc-123 → finds client_id = "client-1"
2. Attaches client_id to request object

// Database query:
SELECT * FROM projects WHERE client_id = 'client-1'
// Returns only Client 1's projects

// Client Instance 2 makes request
GET /api/projects
Authorization: Bearer key-xyz-789

// Service authentication middleware:
1. Validates key-xyz-789 → finds client_id = "client-2"
2. Attaches client_id to request object

// Database query:
SELECT * FROM projects WHERE client_id = 'client-2'
// Returns only Client 2's projects (completely separate data)
```

This architecture ensures that:
- Multiple client instances can run simultaneously without conflicts
- Each client only sees and can only access their own data
- The service can handle unlimited concurrent client connections
- Client instances can run on any machine (local or cloud) and connect to the same service

---

## API Documentation

### Authentication

**Most endpoints require API key authentication.** Include your API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

**How to get an API key:**
1. First, call `/api/clients/create` (no auth required) to create a client
2. You'll receive an API key in the response - **save it immediately!**
3. Use that API key in the `Authorization` header for all other endpoints

### Endpoints Overview

**Status Code Format:** `HTTP_CODE (description)` - **Status:** for success codes, **Errors:** for error codes

#### Public Endpoints (No Authentication Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/clients/create` | **Start here!** Create a new client and get an API key<br/>**Body:** `{"name": "string"}`<br/>**Returns:** `{success, data: {client_id, api_key}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing name), 500 (server error) |
| GET | `/api/vertex-test` | Test Vertex AI connection<br/>**No parameters required**<br/>**Returns:** `{success, data: "AI response", message}`<br/>**Status:** 200 (success), **Errors:** 500 (Vertex AI connection failed) |

#### Protected Endpoints (Require Authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Projects** |||
| POST | `/api/projects/create` | Create a new project<br/>**Required:** `name`<br/>**Optional:** `description`, `goals`, `customer_type`, `theme_id`<br/>**Returns:** `{success, data: {id, name, description, goals, customer_type, theme_id, created_at, client_id}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing name), 401 (no auth), 403 (invalid auth), 500 (server error) |
| GET | `/api/projects` | List all projects for authenticated client<br/>**No parameters required**<br/>**Returns:** `{success, data: [{project objects}], message}`<br/>**Status:** 200 (success), **Errors:** 401 (no auth), 403 (invalid auth), 500 (server error) |
| PUT | `/api/projects/:id` | Update a project<br/>**Path:** `:id`<br/>**Body:** Any of `name`, `description`, `goals`, `customer_type`, `theme_id`<br/>**Returns:** `{success, data: {updated project object}, message}`<br/>**Status:** 200 (success), **Errors:** 400 (invalid data), 401 (no auth), 403 (invalid auth), 404 (project not found), 500 (server error) |
| **Themes** |||
| POST | `/api/themes/create` | Create a new brand theme<br/>**Required:** `name`, `tags[]` (array, must have at least one tag)<br/>**Optional:** `inspirations[]` (array), `project_id`<br/>**Returns:** `{success, data: {id, name, tags, inspirations, created_at, client_id, ...}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing name or tags), 401 (no auth), 403 (invalid auth), 500 (server error) |
| GET | `/api/themes` | List all themes for authenticated client<br/>**No parameters required**<br/>**Returns:** `{success, data: [{theme objects}], message}`<br/>**Status:** 200 (success), **Errors:** 401 (no auth), 403 (invalid auth), 500 (server error) |
| **Contents** |||
| GET | `/api/contents/:project_id` | List all content for a project<br/>**Path:** `:project_id`<br/>**Returns:** `{success, data: [{id, project_id, media_type, media_url, text_content, created_at}], message}`<br/>**Status:** 200 (success), **Errors:** 401 (no auth), 403 (invalid auth), 404 (project not found), 500 (server error) |
| **Text Generation** |||
| POST | `/api/text/generate` | Generate text content using AI<br/>**Required:** `project_id`, `prompt`<br/>**Optional:** `style_preferences` (default: {}), `target_audience` (default: "general"), `variantCount` (default: 3), `media_type` (default: "text")<br/>**Returns:** `{success, data: {variants: [{content_id, generated_content}], project_id, media_type, variant_count, timestamp}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing project_id/prompt), 401 (no auth), 403 (invalid auth), 404 (project/theme not found), 500 (AI generation failed) |
| **Image Generation** |||
| POST | `/api/images/generate` | Generate images using AI with RAG<br/>**Required:** `project_id`, `prompt`<br/>**Optional:** `style_preferences` (default: {}), `target_audience` (default: "general"), `variantCount` (default: 3, range: 1-10), `aspectRatio` (default: "1:1"), `input_images` (array of base64 images), `overlay_text` (string)<br/>**Returns:** `{success, data: {variants: [{content_id, image_url, generated_content}], project_id, variant_count, timestamp}, message}`<br/>**Status:** 201 (created), **Errors:** 400 (missing project_id/prompt), 401 (no auth), 403 (invalid auth), 404 (project/theme not found), 500 (AI generation failed) |
| **Content Validation** |||
| POST | `/api/validate` | Validate content against brand guidelines<br/>**Either:** `content_id` **OR** `content` + `project_id`<br/>**Prerequisites:** Project must have a theme linked AND customer_type must be set (not null)<br/>**Returns:** `{success, data: {validation: {brand_consistency_score, quality_score, overall_score, passes_validation, strengths, issues, recommendations, summary, similarity_details}}, message}`<br/>**Status:** 200 (success), **Errors:** 400 (missing parameters), 401 (no auth), 403 (invalid auth), 404 (content/project/theme not found), 500 (validation failed) |
| **Content Ranking** |||
| POST | `/api/rank` | Rank content items by brand alignment and quality<br/>**Either:** `project_id` **OR** `content_ids[]` (array of content IDs)<br/>**Optional:** `limit` (number)<br/>**Returns:** `{success, data: {ranked_content: [{content_id, rank, brand_consistency_score, quality_score, overall_score, recommendation}], summary: {total_ranked, average_scores}}, message}`<br/>**Status:** 200 (success), **Errors:** 400 (missing project_id or content_ids), 401 (no auth), 403 (invalid auth), 404 (project/content not found), 500 (ranking failed) |

#### Quick Status Code Reference
- **200**: Success (GET, PUT, POST operations completed successfully)
- **201**: Created (POST operations that create new resources)
- **400**: Bad request (missing required fields, invalid data)
- **401**: Unauthorized (missing API key)
- **403**: Forbidden (invalid API key)
- **404**: Not found (resource doesn't exist)
- **500**: Internal server error (server/configuration issue)

### Endpoint Ordering Requirements

**IMPORTANT:** Some endpoints must be called in a specific order to work correctly:

#### Required Setup Sequence

1. **Create Client** (`POST /api/clients/create`) - **MUST BE FIRST**
 - No authentication required
 - Returns API key needed for all subsequent calls
 - **Save the API key immediately** - it's only shown once

2. **Create Theme** (`POST /api/themes/create`) - **BEFORE creating projects**
 - Required for projects that will use validation or generation
 - Must include `name` and `tags` array (non-empty)
 - Returns `theme_id` needed for project creation

3. **Create Project** (`POST /api/projects/create`) - **AFTER theme creation**
 - Must include `theme_id` (from step 2) for validation/generation to work
 - Must include `customer_type` (not null) for validation to work
 - Returns `project_id` needed for content operations

4. **Generate/Validate/Rank Content** - **AFTER project setup**
 - Requires project with `theme_id` and `customer_type` set
 - Can be called in any order once project is properly configured
 - `/api/text/generate` and `/api/images/generate` are **independent** - neither requires the other
 - Both generation endpoints use RAG to retrieve existing project content for context (works with any existing content, or theme-only if none exists)
 - `/api/rank` requires content to exist (either via `project_id` or `content_ids`)

#### Endpoints That Must NOT Be Called in Certain Orders

- **DO NOT** call `/api/validate` before creating a theme and linking it to a project
- **DO NOT** call `/api/text/generate` or `/api/images/generate` before project has `theme_id`
- **DO NOT** call `/api/rank` with `project_id` before any content has been generated for that project
- **DO NOT** call `/api/themes/create` without providing a non-empty `tags` array

### Proper Setup Sequence for Validation

**IMPORTANT:** The `/api/validate` endpoint requires specific project setup to work correctly:

1. **Create a client** (get API key)
2. **Create a theme** (with inspirations for brand guidelines)
3. **Create a project** with:
 - `theme_id` (link to the theme)
 - `customer_type` (must not be null - this is critical!)
4. **Now validation will work**

**Why this matters:** The validation system uses the theme's inspirations and the project's customer_type to assess brand consistency. Without these, the system cannot perform proper validation.

### Quick Reference: Validation Endpoint

**Endpoint:** `POST /api/validate`
**Authentication:** Required (Bearer token)
**Prerequisites:** Project must have `theme_id` AND `customer_type` (not null)

**Request Options:**
- Option A: `{"content_id": "existing-content-id"}`
- Option B: `{"content": "text to validate", "project_id": "project-id"}`

**Response:** Returns brand consistency score, quality score, recommendations, and detailed similarity analysis.

### Example API Calls

#### 1. Create a Client
```bash
curl -X POST http://localhost:3000/api/clients/create \
 -H "Content-Type: application/json" \
 -d '{"name": "My Company"}'
```

Response:
```json
{
 "success": true,
 "data": {
 "client_id": "abc-123",
 "api_key": "your-api-key-here"
 },
 "message": "Client created successfully"
}
```

**IMPORTANT:** Save the API key - it's only shown once!

#### 2. Create a Theme (First - needed for project)
```bash
curl -X POST http://localhost:3000/api/themes/create \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "name": "Modern Tech",
 "tags": ["modern", "professional"],
 "inspirations": ["Apple", "Google"]
 }'
```

**Note:** `tags` is required and must be a non-empty array.

#### 3. Create a Project (with theme_id and customer_type)
```bash
curl -X POST http://localhost:3000/api/projects/create \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "name": "Summer Campaign",
 "description": "Product launch campaign",
 "goals": "Increase awareness",
 "customer_type": "Tech professionals",
 "theme_id": "your-theme-id-from-step-2"
 }'
```

#### 4. Generate Text Content
```bash
curl -X POST http://localhost:3000/api/text/generate \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "project_id": "your-project-id",
 "prompt": "Create a product announcement",
 "variantCount": 3
 }'
```

#### 5. Generate Image Content
```bash
curl -X POST http://localhost:3000/api/images/generate \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "project_id": "your-project-id",
 "prompt": "Professional product image",
 "variantCount": 2,
 "aspectRatio": "16:9"
 }'
```

#### 6. Rank Content
```bash
curl -X POST http://localhost:3000/api/rank \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "project_id": "your-project-id",
 "limit": 10
 }'
```

#### 7. Validate Content
```bash
curl -X POST http://localhost:3000/api/validate \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer YOUR_API_KEY" \
 -d '{
 "content": "Our innovative tech solution provides modern features for professionals",
 "project_id": "your-project-id"
 }'
```

**Note:** This will only work if your project has both a `theme_id` and `customer_type` set (not null).

### Troubleshooting Validation Issues

**Problem:** Getting 500 error when calling `/api/validate`
**Solution:** Ensure your project has:
- `theme_id` is set (not null)
- `customer_type` is set (not null)

**Problem:** Getting 404 "Theme not found" 

**Solution:** Link your project to a theme using `theme_id`


**Problem:** Getting 400 "Must provide either content_id OR (content + project_id)"

**Solution:** Provide either:
- `content_id` (to validate existing content)
- OR both `content` and `project_id` (to validate new text)

---

## Style Checker

This project utilizes ESLint as a code style checker to ensure consistency amongst the Typscript code, and to find any bugs.

The configuration for this service uses:

- ESLint v9 (flat-config format)
- TypeScript-ESLint for TypeScript support
- @eslint/js for base JavaScript rules
- Custom project rules defined in eslint.config.js


To run the style checker, first of course make sure that you have installed all dependencies:

`npm install`

Then, if you added ESLint later, you can install the required packages throught the following command:

`npm install --save-dev eslint typescript-eslint @eslint/js`

To run the style checker, use the following command:

`npm run lint`

To generate an HTML lint report run this command:

`npm run lint:report`

You can find the generated report in the `reports` folder in the root level directory, with the HTML file named, `eslint-report.html`.

The specific rule set that we are using is named in the config file, but to list it here, we use the Base JS recommended rules and recommended Typescript configs. Here is a [link](https://google.github.io/styleguide/jsguide.html) that was referred to every now and then when configuring our style rule set.
And here is a [link](https://google.github.io/styleguide/tsguide.html) for documentation we consulted when reviewing some Typescript rules sets


An example of the report generated is shown below. This screenshot was taken as of 10/23/25. It shows how the current codebase came back clean with our rules implemented with the style checker:
![sc of style checker report](./images/checkstyle_report_10-23.png)

If curious about the documentation that was used to understand the style checker, check out this [link!](https://eslint.org/docs/latest/use/getting-started)


## Tools & Testing

This project includes a comprehensive testing infrastructure with multiple tools for unit testing, API testing, coverage reporting, and CI/CD integration via GitHub Actions.

### Core Testing Framework

#### **Jest** - Complete Testing Framework
- **Purpose**: Core testing framework that handles ALL types of testing
- **Usage**: `npm test`
- **Output**: Test results in terminal with pass/fail status
- **What it provides**: 
 - **Unit Testing**: `describe()`, `it()`, `expect()` functions
 - **API Testing**: Works with supertest for HTTP requests
 - **Function Testing**: Test individual functions and methods
 - **Coverage Reporting**: Built-in coverage measurement
 - **Mocking**: Mock functions, modules, and dependencies

#### **ts-jest** - TypeScript Compiler
- **Purpose**: Compiles TypeScript test files without manual compilation
- **Usage**: Automatically configured in `jest.config.ts`
- **Output**: Transparent TypeScript compilation for tests
- **What it provides**: Seamless TypeScript support in test files

#### **@types/jest** - TypeScript Definitions
- **Purpose**: Provides IntelliSense and type checking for Jest functions
- **Usage**: Automatically loaded
- **Output**: Autocomplete and type safety for Jest functions
- **What it provides**: TypeScript support for `describe`, `it`, `expect`, etc.

### API Testing Tools

#### **supertest** - HTTP Request Testing
- **Purpose**: Simulates HTTP requests to Express app without starting a real server
- **Usage**: Import in test files: `import request from 'supertest'`
- **Output**: HTTP request/response testing with status codes and body validation
- **What it provides**: `request(app).get('/endpoint').expect(200)` syntax

#### **@types/supertest** - TypeScript Definitions
- **Purpose**: Provides IntelliSense for supertest functions
- **Usage**: Automatically loaded
- **Output**: Autocomplete for `request()`, `.get()`, `.post()`, `.expect()`
- **What it provides**: TypeScript support for HTTP testing

### Coverage & Reporting Tools

#### **jest-junit** - JUnit XML Reports
- **Purpose**: Generates XML reports for CI/CD systems (Jenkins, GitHub Actions)
- **Usage**: `npm run test:unit:junit`
- **Output**: `reports/jest-junit.xml` - Standard XML format for CI integration
- **What it provides**: Test results, timing, and metadata in XML format

#### **Jest Coverage** - Built-in Coverage Measurement
- **Purpose**: Measures how much of your code was executed by tests (built into Jest)
- **Usage**: `npm run test:unit` (includes coverage)
- **Output**: Coverage metrics and HTML reports
- **What it provides**: Statement, branch, function, and line coverage percentages

**NOTE:** You can find the HTML report generated by the command by looking into the `coverage` folder and finding the `index.html` file.

Here is a screenshot of the command's output in the terminal after while our service is running (Taken 10/23/25):
![terminal branch coverage output](./images/terminalbranchcov10-23.png)

Here is a screenshot of the HTML report that is generated when checking branch coverage tests (Taken 10/23/25):
![branch coverage report](./images/branchcov_report_10_23.png)


#### **source-map-support** - TypeScript Stack Traces
- **Purpose**: Maps coverage and stack traces correctly back to TypeScript line numbers
- **Usage**: Automatically configured
- **Output**: Better error messages showing TypeScript lines instead of compiled JS
- **What it provides**: Accurate error reporting and debugging

### API Testing with Postman

#### **newman** - Postman Collection Runner
- **Purpose**: Command-line runner for Postman collections (runs API tests automatically)
- **Usage**: `npm run api:test`
- **Output**: API test results in terminal with pass/fail status
- **What it provides**: Automated API endpoint testing without manual Postman usage

#### **newman-reporter-htmlextra** - Beautiful HTML Reports
- **Purpose**: Generates beautiful HTML reports for API test runs
- **Usage**: Automatically configured with newman
- **Output**: `reports/postman-report.html` - Interactive HTML report
- **What it provides**: Visual API test results with detailed request/response information

**NOTE:** Test Dependencies Are Critical, the Postman tests must run in correct order

### Available Commands

```bash
# Basic testing
npm test # Run all tests
npm run test:unit # Run tests with coverage
npm run test:unit:junit # Run tests with coverage + JUnit XML

# API testing
npm run api:test # Run Postman collections

# Full reporting
npm run reports:all # Generate all reports (tests + coverage + API)
npm run coverage:summary # Generate coverage summary
```

### Generated Reports

| Report | Location | Purpose |
|--------|----------|---------|
| **HTML Coverage Report** | `coverage/index.html` | Interactive coverage visualization |
| **JUnit XML** | `reports/jest-junit.xml` | CI/CD integration |
| **API Test Report** | `reports/postman-report.html` | Postman test results |


## Bugs & Challenges Encountered

The following lists some bugs and errors that we ran into. This section serves as:

- When first getting the API to run, we ran into some trouble. It seemed as though `app.listen` was not being hit and that there was this trend that as one updated the `app.ts` file, the run commands stopped running. With some further investigation, such as guidance from AI tools with prompts asking for help to debug, and documentation reading, we were able to solve this issue.

- There was a time when we had issue with figuring out how to protect our API keys, but that was a quick fix by modifying the `/client/create` endpoint.

- During testing, in order to ensure the project was demoable, the `/generate` endpoint was hanging and not returning a response code. We found that content was being generated, despite the hanging of the endpoint. We fixed this accordingly and ensure that the endpoint worked (i.e. returning a response) with further testting.

#### Postman Test Debugging

- Our Postman API tests were failing with 13 errors initially, then we reduced it to 9 errors, and finally down to 2 errors. Here is a breakdown of these error and our debugging of them:

- `/api/generate` and `/api/validate` endpoints were returning 404 errors
- Project creation was failing with 500 errors
- Tests were failing due to missing or invalid project IDs
- There were JSON parsing errors in request bodies
- There were environment variable management issues

We found that the issues were related to database schema requirements, test execution order issue, and missing dependencies. We solved these errors by fixing JSON escaping, fixing environment variables, fixing project creation, creating a dedicated test project, and updating test dependencies.

---

## AI Citations

### AI Citation for JSDoc Documentation, Content Generation Prompts, and AI Integration

- JSDoc Documentation: used AI to generate API documentation for the /generate endpoint ; highlighted the code in cursor and asked it to generate a JSDoc description based on the given parameters / outputs 
- Content generation prompts: used Cursor in-line prompting to create a prompt template for context-aware prompts that incorporates the project data and user requirements. Prompted along the lines of: "Based on the user-inputted data, generate a context-aware prompt that produces relevant marketing content. Incorporate the exact variables highlighted in the prompt"
- AI integration: integrated with Google Cloud Vertex AI for actual content generation. Used GCP credits supplied in class.


### AI Citation for Style Checker:

The "lint" lines in the package.json files were created with the help of ChatGPT and documentation reading. The file `eslint.config.js`, which is where all the ESLint settings are, is also cited in the file and was created with the help and guidance of ChatGPT and online documentation. Prompts given were just that of the nature where we explained what we were hoping to achieve with specific settings and asking how we could go about implementing this.

### AI Citation for Postman API Testing Configuration:

This sections of the project was done with the help of Cursor. A prompt like "modify this file to support proper theme endpoint injection for correct testing usage," was used to generate guidance and code.

### AI Citation for Comments:

There are some comments that were done with the assistance of Copilot. Prompts were of the nature asking for assistance in commenting and providing descriptions for functions and files.

### AI Citation for Content Validation Implementation:
- **Files:** `src/controllers/Computation.ts` (validate function), `src/routes/computationRoutes.ts`
- **Use Case:** Used Cursor to add error handling the `/api/validate` endpoint that compares generated content against brand themes using cosine similarity calculations that i wrote
- **What AI Generated:** 
 - Error handling for edge cases (missing params, invalid IDs)
 - JSDoc comments for the validate function

### AI Citation for API Testing Enhancements:
- **Files:** `postman/collection.json`, `README.md`
- **Use Case:** Used Cursor to expand API test coverage from 25 to 34+ tests
- **What AI Generated:**
 - 4 data persistence tests (create → read → update → read)
 - 5 multi-client isolation tests with separate API keys
 - Collection-level prerequest scripts for logging documentation
 - README section explaining how to verify logging during API tests

### AI Citation for Documentation:
- **Files:** `README.md` (API Documentation section)
- **Use Case:** Enhanced API documentation clarity
- **Prompts:** "Clarify that /api/clients/create is a public endpoint used to obtain API keys"
- **What AI Generated:** "How to get an API key" section with step-by-step instructions

### AI Citation for Client Application (LinkLaunch):
- **Files:** `client/src/pages/*.tsx`, `client/src/components/*.tsx`, `client/src/types/index.ts`, `client/README.md`, `README.md` (Client Application section)
- **Use Case:** Built the LinkLaunch React client application with Cursor AI assistance (component scaffolding + code-complete)
- **What AI Generated:** React components for LinkedIn post generation, validation, and preview; content grouping logic; validation UI with metrics; API integration hooks; TypeScript types; formatting client documentation and diagrams (including multi-client architecture)

### Overall Statement For Use of AI:

This project at times utilized the free AI tools that are Cursor (student plan - free) and ChatGPT (free). These tools were consulted when guidance was needed to setup certain endpoints, the testing framework, and the organization of this README (which has already been documented in the section above). Although there are citations within the code that mark when AI was used, we wanted to include this section and overall statement to ensure that we give a proper citation to external artifcial intelligence tools/sources used. All AI-assisted code was reviewed, tested, and validated before committing. GCP credits for Vertex AI were obtained through Columbia University.
### Overall Statement For Use of AI:

This project at times utilized the free AI tools that are Cursor (student plan - free) and ChatGPT (free). These tools were consulted when guidance was needed to setup certain endpoints, the testing framework, and the organization of this README (which has already been documented in the section above). Although there are citations within the code that mark when AI was used, we wanted to include this section and overall statement to ensure that we give a proper citation to external artifcial intelligence tools/sources used. All AI-assisted code was reviewed, tested, and validated before committing. GCP credits for Vertex AI were obtained through Columbia University.