# LinkLaunch - LinkedIn Marketing Campaign Builder.

LinkLaunch is a focused content creation tool and assistant that helps professionals create engaging LinkedIn marketing posts with AI-generated text and images. It uses the **Ditto Content API** as its AI backbone.

## Client-side functionality

### 1. Multi-Step Content Generation Pipeline
The Create page orchestrates **3 sequential API calls** per post:
1. Generate post text (LinkedIn-optimized copy)
2. Generate image headline (catchy overlay text)
3. Generate image with AI text overlay

### 2. LinkedIn-Specific Business Logic
```typescript
// Client enforces LinkedIn best practices
const LINKEDIN_CHAR_LIMIT = 3000;
const LINKEDIN_OPTIMAL_LENGTH = 1300; // Optimal for engagement

// Client generates relevant hashtags from topic
function generateHashtags(topic: string): string[] {
  const words = topic.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  // Combine topic keywords with common LinkedIn hashtags
  return [...topicHashtags, ...commonHashtags].slice(0, 5);
}
```

### 3. Draft Management System
The client provides complete draft functionality:
- Save posts to localStorage
- Load drafts for editing
- Delete outdated drafts
- Persist image URLs with drafts

### 4. LinkedIn Preview
Client renders a realistic LinkedIn post preview showing how content will appear.

## LinkedIn Post Writer vs. Ditto API Relationship

| Feature | Where It Happens | Description |
|---------|------------------|-------------|
| Text Generation | **Ditto API** | Raw AI content generation with RAG |
| Image Generation | **Ditto API** | Image generation with text overlay |
| **LinkedIn Formatting** | **Client** | Character limits, optimal length hints |
| **Hashtag Generation** | **Client** | Extract keywords, add common tags |
| **Draft Management** | **Client** | localStorage persistence |
| **Post Preview** | **Client** | LinkedIn-style UI preview |
| **Multi-call Orchestration** | **Client** | Coordinates text + headline + image |
| **Copy to Clipboard** | **Client** | Format post with hashtags |

## Features

- **AI Post Generation** - Generate LinkedIn-optimized text with brand voice
- **AI Image Generation** - Create professional images with AI-generated headline overlays
- **Smart Hashtags** - Auto-generate relevant hashtags from your topic
- **Character Tracking** - Real-time character count with optimal length indicator
- **Draft System** - Save, load, and manage post drafts
- **LinkedIn Preview** - See how your post will look before publishing
- **Copy to Clipboard** - One-click copy with formatted hashtags

## How It Uses the Ditto API

| Feature | Ditto API Endpoint | Purpose |
|---------|-------------------|---------|
| Brand Voice | `GET /api/projects`, `GET /api/themes` | Load brand identity for generation |
| Post Text | `POST /api/text/generate` | Generate LinkedIn post copy |
| Image Headline | `POST /api/text/generate` | Generate catchy image overlay text |
| Post Image | `POST /api/images/generate` | Generate image with text overlay |

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

## Running the App

### Development Mode

1. **Start the Ditto API backend** (from project root):
   ```bash
   npm start
   ```

2. **Start the client** (from client directory):
   ```bash
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser

### Connecting to Cloud-Deployed API

Modify `vite.config.ts`:

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

## Application Flow

```
+----------------------------------------------------------+
|  1. LOGIN / REGISTER                                      |
|  - Create account (calls /api/clients/create)             |
|  - Receive API key (stored in localStorage)               |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
|  2. BRAND SETUP (First-time users)                        |
|  - Define brand name, keywords, inspirations              |
|  - Creates a Theme via /api/themes/create                 |
|  - Create first project via /api/projects/create          |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
|  3. CREATE - LinkedIn Post Writer                         |
|  - Enter topic you want to post about                     |
|  - Select brand voice (project/theme)                     |
|  - Toggle "Generate post image" option                    |
|  - CLIENT ORCHESTRATES:                                   |
|    1. Generate post text via Ditto API                    |
|    2. Generate image headline via Ditto API               |
|    3. Generate image with overlay via Ditto API           |
|  - CLIENT PROVIDES:                                       |
|    - LinkedIn character limit tracking                    |
|    - Hashtag generation & management                      |
|    - Draft save/load functionality                        |
|    - LinkedIn preview                                     |
|    - Copy to clipboard                                    |
+----------------------------------------------------------+
                          |
                          v
+----------------------------------------------------------+
|  4. CONTENT LIBRARY                                       |
|  - Browse all generated content                           |
|  - Filter by campaign, type, search                       |
|  - Reuse high-quality content                             |
+----------------------------------------------------------+
```

### Client Authentication Model (Clarification for Service Architecture)

Each API key represents a client application instance, not an individual end user.
In a production deployment, the client would securely store its API key in server-side configuration (environment variables or backend storage).
The current UI-based API key entry is provided strictly for demonstration, testing, and ease of deployment during the course project.


## Project Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx          # Authentication
│   │   ├── BrandSetup.tsx         # Onboarding wizard
│   │   ├── CampaignsDashboard.tsx # Home/campaign overview
│   │   ├── LinkedInWriter.tsx     # ** KEY: LinkedIn Post Creator **
│   │   └── ContentLibraryPage.tsx # Browse content
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

## Key Code: Client-Side LinkedIn Logic

The `LinkedInWriter.tsx` demonstrates real client functionality:

```typescript
// Client orchestrates multiple API calls
const generatePost = useMutation({
  mutationFn: async () => {
    // 1. Generate post text with LinkedIn-specific prompt
    const response = await apiClient.generateText({
      project_id: selectedProjectId,
      prompt: `Write a professional LinkedIn post about: ${topic}.
        Keep it under ${LINKEDIN_OPTIMAL_LENGTH} characters...`,
      variantCount: 1,
    });
    setGeneratedContent(response.data?.variants?.[0]?.generated_content);

    // 2. Generate hashtags (CLIENT-SIDE logic)
    generateHashtags(topic);

    // 3. Generate image with AI-generated headline
    if (includeImage) {
      // First, generate a catchy headline for overlay
      const headlineResponse = await apiClient.generateText({
        prompt: `Write a powerful headline (max 10 words)...`,
      });

      // Then generate image with that headline
      const imageResponse = await apiClient.generateImage({
        prompt: `Professional LinkedIn post image...`,
        overlay_text: headlineResponse.data?.variants?.[0]?.generated_content,
      });
      setGeneratedImageUrl(imageResponse.data?.variants?.[0]?.image_url);
    }
  }
});

// Client manages drafts in localStorage
const saveDraft = () => {
  const draft = { topic, content, hashtags, imageUrl, ... };
  localStorage.setItem('linkedin_drafts', JSON.stringify([draft, ...drafts]));
};
```

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

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

This is a **genuine client application** that demonstrates how developers can build focused tools using the Ditto Content API:

- **Ditto API**: Provides atomic operations (generate text, generate image, validate content)
- **Client**: Provides LinkedIn-specific workflow, formatting, drafts, and preview

The API provides:
- AI-powered content generation (text and images)
- RAG-enhanced prompts (learns from past content)
- Brand voice consistency via themes
- Multi-tenant data isolation

See the main project [README.md](../README.md) for full API documentation.

## License

ISC
