# CopyForge - AI Marketing Asset Generator

CopyForge is a marketing asset generation platform that creates complete, on-brand marketing packages. It uses the **Ditto Content API** as its AI backbone for content generation and brand validation.

## What Makes CopyForge a REAL Client (Not a UI Wrapper)

CopyForge is **NOT** a simple API wrapper. It demonstrates genuine client-side functionality:

### 1. Orchestration Logic
The Asset Generator orchestrates **11+ sequential API calls** per generation:
- 3 headline variants (generate + validate each)
- 2 tagline variants (generate + validate each)
- 2 body copy variants (generate + validate each)
- 2 CTA variants (generate + validate each)
- 2 hero images (generate with quality metrics)

### 2. Client-Side Ranking Algorithm
```typescript
// Custom ranking formula - client's own computation
function rankAssets(assets: AssetVariant[]): AssetVariant[] {
  return [...assets].sort((a, b) => {
    const scoreA = (a.brandScore * 0.6) + (a.qualityScore * 0.3) + (a.passesValidation ? 10 : 0);
    const scoreB = (b.brandScore * 0.6) + (b.qualityScore * 0.3) + (b.passesValidation ? 10 : 0);
    return scoreB - scoreA;
  });
}
```

### 3. Asset Package Assembly
The client intelligently selects the best-performing assets and assembles them into a recommended package with combined scoring.

### 4. Export Functionality
Client creates downloadable JSON packages with all variants and scores - this data transformation happens entirely client-side.

## CopyForge vs. Ditto API Relationship

| Feature | Where It Happens | Description |
|---------|------------------|-------------|
| Text Generation | **Ditto API** | Raw AI content generation |
| Image Generation | **Ditto API** | Image generation with RAG enhancement |
| Brand Validation | **Ditto API** | Score content against embeddings |
| **Multi-call Orchestration** | **CopyForge** | Coordinates 11+ API calls per package |
| **Ranking Algorithm** | **CopyForge** | Custom weighted scoring formula |
| **Asset Assembly** | **CopyForge** | Selects best assets, calculates combined scores |
| **Progress Tracking** | **CopyForge** | Real-time generation status |
| **Package Export** | **CopyForge** | JSON export with all variants |
| **Workflow Management** | **CopyForge** | Campaigns, themes, organization |

## What CopyForge Does

- **Asset Generator** - Generate complete marketing packages (headlines, taglines, body copy, CTAs, hero images)
- **Campaign Management** - Organize marketing campaigns with brand themes
- **AI Content Generation** - Generate text copy and images with automatic brand consistency
- **Real-time Brand Validation** - Every piece of generated content is automatically scored
- **Content Library** - Browse, search, and reuse all generated content
- **Package Export** - Download complete asset packages as JSON

## How CopyForge Uses the Ditto API

| CopyForge Feature | Ditto API Endpoint | Purpose |
|-------------------|-------------------|---------|
| Brand Setup | `POST /api/themes/create` | Store brand identity (keywords, inspirations) |
| Campaign Creation | `POST /api/projects/create` | Create marketing campaigns linked to brands |
| Text Generation | `POST /api/text/generate` | Generate AI-powered marketing copy |
| Image Generation | `POST /api/images/generate` | Generate branded images with RAG enhancement |
| Content Validation | `POST /api/validate` | Score content against brand guidelines |
| Content Library | `GET /api/contents/:project_id` | Retrieve all generated content |

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- **Ditto Content API** running (either locally at `http://localhost:3000` or deployed on GCP)

## Installation

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running CopyForge

### Development Mode

1. **Start the Ditto API backend** (from project root):
   ```bash
   npm start
   ```

2. **Start CopyForge** (from client directory):
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser

### Connecting to Cloud-Deployed API

To connect CopyForge to the GCP-deployed Ditto API, modify `vite.config.ts`:

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

## Multi-Client Usage

CopyForge supports multiple simultaneous client instances:

### How Clients Are Differentiated
- Each organization gets a unique **API key** on registration
- API key is linked to a `client_id` in the Ditto service
- All data (themes, campaigns, content) is isolated per client

### Running Multiple Instances
1. **Browser 1**: Create account for "Company A" -> gets API key A
2. **Browser 2** (or incognito): Create account for "Company B" -> gets API key B
3. Both can use CopyForge simultaneously with isolated data

### Concurrency Handling
- The Ditto API handles concurrent requests safely
- Each request includes the API key in the `Authorization: Bearer {key}` header
- Database operations are isolated per `client_id`

## Application Flow

```
+-----------------------------------------------------------------+
|  1. LOGIN / REGISTER                                             |
|  - Create account (calls /api/clients/create)                    |
|  - Receive API key (stored in localStorage)                      |
|  - Or login with existing API key                                |
+-----------------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
|  2. BRAND SETUP (First-time users)                               |
|  - Define brand name, keywords, inspirations                     |
|  - Creates a Theme via /api/themes/create                        |
|  - Create first campaign via /api/projects/create                |
+-----------------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
|  3. ASSET GENERATOR (Key Feature)                                |
|  - Enter campaign goal + target audience                         |
|  - CLIENT ORCHESTRATES: 11+ API calls                            |
|    - 3x headline generate + validate                             |
|    - 2x tagline generate + validate                              |
|    - 2x body copy generate + validate                            |
|    - 2x CTA generate + validate                                  |
|    - 2x hero image generate                                      |
|  - CLIENT RANKS: custom scoring algorithm                        |
|  - CLIENT ASSEMBLES: recommended package                         |
|  - CLIENT EXPORTS: downloadable JSON                             |
+-----------------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
|  4. CONTENT LIBRARY                                              |
|  - Browse all generated content                                  |
|  - Filter by campaign, type, search                              |
|  - Reuse high-scoring content                                    |
+-----------------------------------------------------------------+
```

## Project Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx          # Authentication
│   │   ├── BrandSetup.tsx         # Onboarding wizard
│   │   ├── CampaignsDashboard.tsx # Campaign management
│   │   ├── AssetGenerator.tsx     # ** KEY: Multi-call orchestration **
│   │   ├── CampaignWorkspace.tsx  # Generate + validate content
│   │   ├── ContentLibraryPage.tsx # Browse content
│   │   └── SettingsPage.tsx       # Brand themes & account
│   ├── components/
│   │   └── Layout.tsx             # App shell with navigation
│   ├── context/
│   │   └── AuthContext.tsx        # API key management
│   ├── services/
│   │   └── api.ts                 # Ditto API client
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── package.json
├── vite.config.ts                 # Proxy config for API
└── README.md
```

## Key Code: Client-Side Orchestration

The `AssetGenerator.tsx` demonstrates real client functionality:

```typescript
// Client orchestrates multiple API calls sequentially
const generateAssetPackMutation = useMutation({
  mutationFn: async () => {
    // STAGE 1: Generate 3 headline variants
    for (let i = 0; i < 3; i++) {
      const response = await apiClient.generateText({ ... });
      const validation = await apiClient.validateContent({ ... });
      // Client computes combined score
      const overallScore = (brandScore * 0.6) + (qualityScore * 0.4);
      newPack.headlines.push({ ...variant, overallScore });
    }

    // STAGE 2-5: Similar for taglines, body, CTAs, images

    // STAGE 6: CLIENT-SIDE RANKING (not from API!)
    newPack.headlines = rankAssets(newPack.headlines);

    // STAGE 7: CLIENT ASSEMBLES best package
    const recommended = assembleAssetPackage(newPack);

    return newPack;
  }
});
```

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## End-to-End Testing

See [E2E_TESTS.md](./E2E_TESTS.md) for the complete manual testing checklist.

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router v6** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icons

## Relationship to Ditto Content API

CopyForge is a **genuine client application** that demonstrates how third-party developers can build applications using the Ditto Content API. The key distinction:

- **Ditto API**: Provides atomic operations (generate text, generate image, validate content)
- **CopyForge**: Provides workflows, orchestration, ranking, assembly, and export

The API provides:
- AI-powered content generation (text and images)
- RAG-enhanced prompts (learns from past content)
- Semantic brand validation (embedding-based similarity)
- Multi-tenant data isolation

See the main project [README.md](../README.md) for full API documentation.

## License

ISC
