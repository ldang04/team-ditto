# BrandForge Studio - Client Application

A modern, full-featured web application for AI-powered marketing content creation. Built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Theme Management** - Create and manage brand themes with visual style analysis
- 📁 **Project Dashboard** - Organize marketing projects with themes and goals
- ✍️ **Text Generation** - Generate AI-powered text content with multiple variants
- 🖼️ **Image Generation** - Create branded images with RAG-enhanced prompts and quality metrics
- ✅ **Content Validation** - Validate content against brand guidelines with detailed scoring
- 📚 **Content Library** - Browse, search, and filter all generated content

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend API server running on `http://localhost:3000`

## Installation

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

The Vite dev server is configured to proxy API requests to `http://localhost:3000`, so make sure your backend API is running.

## Building for Production

Build the application:

```bash
npm run build
```

The production build will be in the `dist/` directory.

Preview the production build:

```bash
npm run preview
```

## Project Structure

```
client/
├── src/
│   ├── components/      # Reusable UI components
│   ├── context/         # React context providers (Auth)
│   ├── pages/           # Page components
│   ├── services/        # API client and services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component with routing
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── tailwind.config.js   # Tailwind CSS configuration
```

## Getting Started

1. **Start the backend API server** (from the project root):
   ```bash
   npm start
   ```

2. **Start the client application** (from the client directory):
   ```bash
   npm run dev
   ```

3. **Open your browser** to `http://localhost:5173`

4. **Create an account** or login with an existing API key:
   - Click "Create New Account" and enter your company name
   - Save your API key (it's only shown once!)
   - Or login with an existing API key

5. **Create a Theme**:
   - Navigate to "Themes" in the sidebar
   - Click "Create Theme"
   - Fill in theme details (name, tags, inspirations, font)

6. **Create a Project**:
   - Navigate to "Projects"
   - Click "Create Project"
   - Link it to a theme and set customer type (required for validation)

7. **Generate Content**:
   - Use "Text Generation" or "Image Generation" pages
   - Select your project and enter a prompt
   - View generated variants

8. **Validate Content**:
   - Use the "Validation" page to check content against brand guidelines
   - View detailed scores and recommendations

## API Integration

The client uses the API client in `src/services/api.ts` which:
- Automatically includes the API key in requests
- Handles authentication via Bearer token
- Provides type-safe API methods
- Stores API key in localStorage

## Technologies Used

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client
- **Lucide React** - Icon library

## Environment Configuration

The client is configured to proxy API requests to `http://localhost:3000` by default. To change this, modify `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://your-api-url:port',
      changeOrigin: true,
    },
  },
}
```

## Troubleshooting

### API Connection Issues
- Ensure the backend API is running on `http://localhost:3000`
- Check browser console for CORS errors
- Verify your API key is stored in localStorage

### Build Errors
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run build`

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check that `index.css` imports Tailwind directives

## License

ISC

