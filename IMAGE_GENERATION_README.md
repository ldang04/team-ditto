# Image Generation with RAG and Computational Analysis

## Overview

This document describes the image generation system built into the Ditto API. The system uses **Vertex AI Imagen** for image generation, combined with **RAG (Retrieval Augmented Generation)** and **extensive computational analysis** to ensure brand consistency and high-quality output.

## Architecture

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Generate Endpoint                         │
│                    POST /api/generate                        │
│              (Routes to Text or Image Generation)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├── media_type = "text"
                              │   └──> Text Generation (Gemini)
                              │
                              └── media_type = "image"
                                  └──> Image Generation Pipeline
                                       (9 Computational Steps)
```

### Services

1. **ImageGenerationService** - Handles Vertex AI Imagen API integration
   - Image generation with branded prompts
   - Prompt engineering and quality scoring
   - Style/mood/color extraction from themes

2. **ImageComputationService** - Heavy computational analysis
   - RAG retrieval from existing content
   - Theme analysis (colors, styles, mood)
   - Brand strength calculations
   - Prompt enhancement with context

3. **StorageService** - File management with Supabase Storage
   - Image upload and storage
   - Public URL generation
   - Batch operations

## How It Works

### 9-Step Computational Pipeline

When you request image generation, the system performs these computational steps:

#### STEP 1: RAG Retrieval
```
Input: User prompt + Project ID
Process:
  1. Generate embedding for user prompt
  2. Retrieve all existing content for project
  3. Calculate similarity scores
  4. Select top 5 most relevant content pieces
  5. Calculate average similarity
Output: RAG Context with relevant historical content
```

#### STEP 2: Theme Analysis
```
Input: Theme data (name, tags, inspirations)
Process:
  1. Extract color palette (primary, secondary, accent)
  2. Calculate style scores (modern, vintage, elegant, etc.)
  3. Determine visual mood (energetic, calm, professional, etc.)
  4. Calculate complexity score
  5. Calculate brand strength
Output: Comprehensive theme analysis
```

#### STEP 3: Prompt Enhancement with RAG
```
Input: Original prompt + RAG context + Theme analysis
Process:
  1. Incorporate insights from similar content
  2. Add color palette guidance
  3. Add mood enhancement
  4. Add dominant style characteristics
Output: Enhanced prompt with contextual information
```

#### STEP 4: Branded Prompt Building
```
Input: Enhanced prompt + Project data + Theme data
Process:
  1. Combine user prompt with brand elements
  2. Add theme style characteristics
  3. Add color palette specifications
  4. Add quality modifiers
  5. Build negative prompt to avoid unwanted elements
Output: Comprehensive branded prompt + negative prompt
```

#### STEP 5: Prompt Quality Scoring
```
Input: Branded prompt + Theme tags
Process:
  1. Analyze prompt length
  2. Check theme tag integration
  3. Check quality modifiers
  4. Check style descriptors
Output: Prompt quality score (0-100)
```

#### STEP 6: Quality Prediction
```
Input: Theme analysis + RAG context + Prompt length
Process:
  1. Factor brand strength
  2. Factor RAG similarity
  3. Factor prompt quality
  4. Factor theme complexity
Output: Predicted generation quality (0-100)
```

#### STEP 7: Image Generation
```
Input: Branded prompt + Negative prompt + Parameters
Process:
  1. Call Vertex AI Imagen API
  2. Generate specified number of variants
  3. Receive base64-encoded images
Output: Array of generated images
```

#### STEP 8: Storage and Database
```
Input: Generated images
Process:
  1. Create content record (get ID)
  2. Upload image to Supabase Storage
  3. Update content record with public URL
  4. Generate embeddings for prompt
  5. Store embeddings for future RAG
Output: Saved variants with URLs
```

#### STEP 9: Metrics Calculation
```
Input: All computational data from previous steps
Process:
  1. Aggregate RAG similarity metrics
  2. Compile theme analysis results
  3. Report quality scores
  4. Count context items
Output: Comprehensive computation metrics
```

## API Usage

### Generate Images

**Endpoint:** `POST /api/generate`

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "project_id": "uuid-of-project",
  "prompt": "A modern smartphone display showing the app interface",
  "media_type": "image",
  "variantCount": 3,
  "aspectRatio": "16:9",
  "style_preferences": {
    "composition": "centered",
    "lighting": "natural",
    "avoid": "cartoonish"
  },
  "target_audience": "young professionals"
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| project_id | string | Yes | - | UUID of the project |
| prompt | string | Yes | - | Description of image to generate |
| media_type | string | Yes | "text" | Must be "image" for image generation |
| variantCount | number | No | 3 | Number of image variants to generate (1-4) |
| aspectRatio | string | No | "1:1" | Image aspect ratio: "1:1", "16:9", "9:16", "4:3", "3:4" |
| style_preferences | object | No | {} | Additional style preferences |
| target_audience | string | No | "general" | Target audience for the content |

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Images generated successfully with RAG and computational analysis",
  "data": {
    "success": true,
    "variants": [
      {
        "content_id": "uuid-1",
        "image_url": "https://your-project.supabase.co/storage/v1/object/public/content-images/project-id/content-id_hash.png",
        "prompt": "A modern smartphone display showing the app interface",
        "branded_prompt": "A modern smartphone display showing the app interface, in a Tech Startup style, with modern clean aesthetic, conveying a professional innovative mood...",
        "seed": 123456789
      },
      {
        "content_id": "uuid-2",
        "image_url": "https://...",
        "prompt": "...",
        "branded_prompt": "...",
        "seed": 987654321
      },
      {
        "content_id": "uuid-3",
        "image_url": "...",
        "prompt": "...",
        "branded_prompt": "...",
        "seed": 456789123
      }
    ],
    "project_id": "uuid-of-project",
    "media_type": "image",
    "variant_count": 3,
    "computation_metrics": {
      "rag_similarity": 0.78,
      "theme_analysis": {
        "style_score": 85,
        "dominant_styles": ["modern", "professional", "minimalist"],
        "visual_mood": "innovative",
        "complexity_score": 72,
        "brand_strength": 88,
        "color_palette": {
          "primary": ["blue", "white"],
          "secondary": ["gray"],
          "accent": ["orange"],
          "mood": "professional"
        }
      },
      "prompt_quality": 82,
      "predicted_quality": 86,
      "rag_context_items": 5
    },
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
}
```

### Validate Generated Images

**Endpoint:** `POST /api/validate`

**Request Body:**
```json
{
  "content_id": "uuid-of-generated-image"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "success": true,
    "content_id": "uuid-of-generated-image",
    "project_id": "uuid-of-project",
    "validation": {
      "brand_consistency_score": 85,
      "quality_score": 88,
      "overall_score": 86,
      "passes_validation": true,
      "strengths": [
        "Strong alignment with brand guidelines",
        "High-quality prompt with good structure"
      ],
      "issues": [],
      "recommendations": [
        "Content is well-aligned with brand"
      ],
      "summary": "Excellent content that aligns well with brand guidelines and maintains high quality.",
      "similarity_details": {
        "theme_similarity": 88,
        "inspiration_similarity": 82,
        "description_similarity": 86,
        "goals_similarity": 84,
        "audience_similarity": 85
      }
    },
    "timestamp": "2025-11-12T10:31:00.000Z"
  }
}
```

## Computational Metrics Explained

### RAG Similarity (0-1)
- Measures how well the prompt aligns with historical content
- Higher values indicate better contextual alignment
- **0.7+**: Strong alignment with past successful content
- **0.5-0.7**: Moderate alignment
- **<0.5**: Weak alignment (may be exploring new direction)

### Style Score (0-100)
- Composite score of theme characteristics
- Based on dominant style, complexity, and brand strength
- **85+**: Excellent brand definition
- **70-85**: Good brand clarity
- **<70**: Needs stronger brand definition

### Brand Strength (0-100)
- How well-defined the brand theme is
- Factors: number of tags, inspirations, color definitions
- **80+**: Very strong brand identity
- **60-80**: Adequate brand definition
- **<60**: Weak brand definition

### Prompt Quality (0-100)
- Quality of the generated prompt for image generation
- Factors: length, theme integration, quality keywords, style descriptors
- **80+**: Excellent prompt
- **60-80**: Good prompt
- **<60**: Needs improvement

### Predicted Quality (0-100)
- Prediction of how well the generated image will align with brand
- Composite of brand strength, RAG similarity, and prompt quality
- **85+**: Expect excellent results
- **70-85**: Expect good results
- **<70**: May need prompt refinement

## Image Quality Scoring (Validation)

When validating images, the system performs **10 computational checks**:

1. **Descriptive Detail** - Is the prompt sufficiently descriptive?
2. **Theme Tag Presence** - Are brand theme tags incorporated?
3. **Visual Quality Keywords** - Does it include quality indicators?
4. **Style Descriptors** - Are style keywords present?
5. **Color Mentions** - Does it specify colors?
6. **Composition Keywords** - Are compositional elements defined?
7. **Negative Indicators** - Does it avoid bad quality markers?
8. **Brand Inspiration Alignment** - Does it reference brand inspirations?
9. **Target Audience Mentions** - Is the audience considered?
10. **Prompt Structure Quality** - Is the prompt well-structured?

## RAG (Retrieval Augmented Generation)

### How RAG Enhances Image Generation

1. **Content Retrieval**
   - System retrieves existing content from the project
   - Generates embeddings for all content
   - Calculates similarity to current prompt

2. **Context Extraction**
   - Top 5 most similar content pieces selected
   - Extracts themes, styles, and patterns
   - Identifies successful brand characteristics

3. **Prompt Enhancement**
   - Original prompt enriched with historical context
   - Adds proven style elements
   - Incorporates successful brand patterns

### Benefits of RAG

- **Consistency**: Maintains brand consistency across all generated images
- **Learning**: System learns from successful past content
- **Context**: Understands project-specific nuances
- **Quality**: Improves generation quality over time

## Supabase Storage Integration

### Storage Bucket

- **Name**: `content-images`
- **Public**: Yes (images are publicly accessible)
- **Size Limit**: 10MB per image
- **Allowed Types**: PNG, JPEG, JPG, WebP

### File Organization

```
content-images/
├── {project-id-1}/
│   ├── {content-id-1}_{random-hash}.png
│   ├── {content-id-2}_{random-hash}.png
│   └── {content-id-3}_{random-hash}.png
├── {project-id-2}/
│   ├── {content-id-4}_{random-hash}.png
│   └── ...
```

### Storage Operations

- **Upload**: Base64 image → Buffer → Supabase Storage → Public URL
- **Retrieval**: Content record contains `media_url` field
- **Deletion**: Optional cleanup via `StorageService.deleteImage()`

## Vertex AI Imagen Configuration

### Model

- **Name**: `imagen-3.0-generate-001`
- **Location**: `us-central1`
- **Provider**: Google Cloud Vertex AI

### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| prompt | string | The enhanced branded prompt | - |
| negativePrompt | string | Elements to avoid | Generated |
| sampleCount | number | Number of images to generate | variantCount |
| aspectRatio | string | Image dimensions | "1:1" |
| seed | number | Random seed for reproducibility | Random |
| guidanceScale | number | Adherence to prompt (1-20) | 15 |

### Guidance Scale

Higher guidance scale = stricter adherence to prompt:
- **15-20**: Strong brand alignment (recommended)
- **10-15**: Balanced creativity and adherence
- **1-10**: More creative freedom

## Error Handling

### Common Errors

1. **Project/Theme Not Found** (404)
   ```json
   {
     "success": false,
     "statusCode": 404,
     "message": "Project not found"
   }
   ```

2. **Missing Required Fields** (400)
   ```json
   {
     "success": false,
     "statusCode": 400,
     "message": "Missing required fields: project_id and prompt"
   }
   ```

3. **Image Generation Failed** (500)
   ```json
   {
     "success": false,
     "statusCode": 500,
     "message": "Image generation failed: [error details]"
   }
   ```

4. **Storage Upload Failed** (500)
   ```json
   {
     "success": false,
     "statusCode": 500,
     "message": "Failed to save any image variants to storage/database"
   }
   ```

## Performance Considerations

### Timing

Typical image generation request timeline:
```
RAG Retrieval:           500ms - 1s
Theme Analysis:          50ms - 100ms
Prompt Enhancement:      10ms - 50ms
Imagen Generation:       5s - 15s (per variant)
Storage Upload:          500ms - 2s (per image)
Embedding Generation:    200ms - 500ms (per variant)

Total (3 variants):      ~20s - 50s
```

### Optimization Tips

1. **Reduce Variants**: Generate fewer images for faster response
2. **Batch Operations**: All variants processed in parallel where possible
3. **Caching**: Embeddings cached to reduce computation
4. **Async Operations**: Image storage and embeddings run concurrently

## Cost Estimation

### Vertex AI Imagen Pricing (approximate)

- **Image Generation**: ~$0.02 per image (Imagen 3)
- **Text Embeddings**: ~$0.00001 per 1000 characters

### Example Costs

| Operation | Images | Embeddings | Total Cost |
|-----------|--------|------------|------------|
| Single request (3 variants) | $0.06 | $0.0001 | ~$0.06 |
| 100 requests (300 images) | $6.00 | $0.01 | ~$6.01 |
| 1000 requests (3000 images) | $60.00 | $0.10 | ~$60.10 |

## Environment Variables

Required environment variables:

```bash
# GCP Configuration
GCP_PROJECT_ID=your-gcp-project-id

# Supabase Configuration  
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Optional: Model Configuration
VERTEX_MODEL_TEXT=gemini-2.5-flash-lite
```

## Testing

### Example Request with cURL

```bash
curl -X POST https://your-api.com/api/generate \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "prompt": "Modern office workspace with laptop and coffee",
    "media_type": "image",
    "variantCount": 2,
    "aspectRatio": "16:9",
    "style_preferences": {
      "composition": "rule of thirds",
      "lighting": "natural window light"
    },
    "target_audience": "remote workers"
  }'
```

### Example Request with JavaScript

```javascript
const response = await fetch('https://your-api.com/api/generate', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your-api-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    project_id: '123e4567-e89b-12d3-a456-426614174000',
    prompt: 'Modern office workspace with laptop and coffee',
    media_type: 'image',
    variantCount: 2,
    aspectRatio: '16:9',
    style_preferences: {
      composition: 'rule of thirds',
      lighting: 'natural window light'
    },
    target_audience: 'remote workers'
  })
});

const data = await response.json();
console.log('Generated images:', data.data.variants);
console.log('Computation metrics:', data.data.computation_metrics);
```

## Best Practices

### 1. Prompt Engineering

**Good Prompts:**
- ✅ "Professional headshot of a business executive in modern office with natural lighting"
- ✅ "Minimalist product photography of smartphone on white background, studio lighting"
- ✅ "Vibrant food photography of gourmet dish, overhead view, natural colors"

**Bad Prompts:**
- ❌ "Person" (too vague)
- ❌ "Make it look good!!!" (no specifics)
- ❌ "Blurry low quality image" (negative quality indicators)

### 2. Brand Consistency

- Define clear theme tags (colors, styles, moods)
- Add multiple brand inspirations
- Generate diverse content to build RAG context
- Validate generated images to ensure quality

### 3. Iterative Improvement

1. Generate initial images
2. Review computation metrics
3. Adjust theme tags if needed
4. Regenerate with improved prompts
5. Build library of validated content

### 4. Aspect Ratio Selection

| Use Case | Aspect Ratio | Best For |
|----------|-------------|----------|
| Social Media Posts | 1:1 | Instagram, Facebook |
| Stories | 9:16 | Instagram Stories, TikTok |
| YouTube Thumbnails | 16:9 | Video content |
| Pinterest | 2:3 | Vertical pins |
| Presentations | 4:3 or 16:9 | Slides, decks |

## Summary

The image generation system provides:

✅ **RAG-Powered Generation**: Learns from historical content  
✅ **9-Step Computational Pipeline**: Extensive analysis and scoring  
✅ **Brand Consistency**: Automatic theme integration  
✅ **Quality Assurance**: Multi-dimensional validation  
✅ **Scalable Storage**: Supabase integration  
✅ **Detailed Metrics**: Comprehensive reporting  

For questions or issues, check the logs or contact the development team.

