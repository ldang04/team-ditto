# BrandForge Studio - Quick Start Guide

## 🚀 Quick Setup

1. **Install dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Start the backend API** (from project root):
   ```bash
   npm start
   ```

3. **Start the client** (from client directory):
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to `http://localhost:5173`

## 📝 First Steps

1. **Create Account:**
   - Enter your company name
   - Save your API key (shown only once!)

2. **Create a Theme:**
   - Go to "Themes" → "Create Theme"
   - Add name, tags, inspirations (e.g., "Apple", "Google")
   - Save

3. **Create a Project:**
   - Go to "Projects" → "Create Project"
   - Link to your theme
   - Set customer type (required for validation!)

4. **Generate Content:**
   - Use "Text Generation" or "Image Generation"
   - Select project, enter prompt
   - View variants

5. **Validate:**
   - Go to "Validation"
   - Enter content ID or paste text
   - View brand consistency scores

## 🎯 Key Features

- ✅ **Theme Management** - Visual brand style editor
- ✅ **Project Dashboard** - Organize campaigns
- ✅ **AI Text Generation** - Multiple variants
- ✅ **AI Image Generation** - With RAG metrics
- ✅ **Content Validation** - Brand compliance scoring
- ✅ **Content Library** - Search and filter all content

## 🔧 Troubleshooting

**API Connection Issues:**
- Ensure backend is running on port 3000
- Check browser console for errors
- Verify API key in localStorage

**Port Already in Use:**
- Change port in `vite.config.ts` (server.port)

**Build Errors:**
- Delete `node_modules` and reinstall
- Check TypeScript version compatibility

## 📚 Next Steps

- Explore all pages in the sidebar
- Generate content for your projects
- Validate content against brand guidelines
- Browse your content library

Happy creating! 🎨

