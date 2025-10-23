# Testing Guide

## Setup Test Environment

### 1. Create New API Key

Create a fresh API key using the public endpoint:

```bash
curl -X POST http://localhost:3000/api/clients/create \
  -H "Content-Type: application/json" \
  -d '{"name": "My Company"}'
```

Response:
```json
{
  "message": "Client created successfully",
  "client_id": "abc-123",
  "api_key": "your-new-api-key-here"
}
```

**Important**: Save the API key immediately - it's only shown once!

### 2. Set Environment Variables

Create test credentials as environment variables:

```bash
export TEST_API_KEY="your-api-key-here"
export TEST_PROJECT_ID="your-project-id-here"
```

Or add them to your `.env` file:

```bash
# Add to .env
TEST_API_KEY=your-api-key-here
TEST_PROJECT_ID=your-project-id-here
```

### 3. Run Tests

```bash
# Using environment variables directly
API_KEY=your-key PROJECT_ID=your-project node test-routes.js

# Or if in .env, the test script will read from there
node test-routes.js
```

## Security Notes

- **NEVER** commit real credentials to git
- `test-data.json`, `test-routes.js`, and `test-validate.js` are gitignored
- Use `test-data.example.json` as a template
- Create fresh API keys for testing when needed

## Getting Test Credentials

### Option 1: From Database
Query your Supabase database:

```sql
-- Get an API key
SELECT key FROM api_keys WHERE client_id = 'your-client-id';

-- Get a project ID
SELECT id FROM projects LIMIT 1;
```

### Option 2: Create New Test Credentials
Use your API endpoints to create a test client and get an API key:

```bash
# Create a test client (requires existing auth)
curl -X POST http://localhost:3000/api/clients \\
  -H "Authorization: Bearer existing-key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Test Client"}'
```

