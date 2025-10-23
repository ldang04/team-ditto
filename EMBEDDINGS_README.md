# Embedding System Overview

## What Are Embeddings?

Embeddings convert text into numbers (vectors) that capture semantic meaning. Similar text has similar vectors.

**Example:**
```
"Professional enterprise solution" → [0.23, 0.45, ..., 0.67] (768 numbers)
"Corporate business software"     → [0.24, 0.44, ..., 0.66] (768 numbers)
                                   ↑ Very similar (90% match)

"Buy now!!! Click here!!!"       → [0.89, 0.12, ..., 0.34] (768 numbers)
                                   ↑ Very different (20% match)
```

## How We Use Embeddings

### 1. Content Generation (`/api/generate`)
- Generates marketing text with AI
- Automatically creates embeddings for each variant
- Stores in database for later validation

### 2. Content Validation (`/api/validate`)
- Compares content embedding to brand embeddings
- Calculates similarity scores
- Returns: "85% brand consistent"

## Architecture

### Before Refactoring:
```
ComputationController (500+ lines)
├── Content generation
├── Embedding generation
├── Embedding storage
├── Similarity calculation
├── Content validation
└── Quality scoring
```

### After Refactoring:
```
EmbeddingService (separate service)
├── Generate document embeddings
├── Generate query embeddings
├── Store embeddings
├── Calculate similarity
└── Fallback embedding generation

ComputationController (cleaner)
├── Content generation
├── Content validation
└── Uses EmbeddingService
```

## Vertex AI Integration

### Model: `text-embedding-004`
- Dimensions: 768
- Location: us-central1
- Task Types:
  - `RETRIEVAL_DOCUMENT`: For storing content
  - `RETRIEVAL_QUERY`: For search queries

### API Call Example:
```typescript
POST https://us-central1-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/us-central1/publishers/google/models/text-embedding-004:predict

{
  "instances": [{
    "content": "Your text here",
    "task_type": "RETRIEVAL_DOCUMENT"
  }]
}

Response: {
  "predictions": [{
    "embeddings": {
      "values": [0.23, 0.45, ..., 0.67]  // 768 numbers
    }
  }]
}
```

## Fallback System

If Vertex AI fails:
- Uses hash-based embedding generation
- Creates deterministic 768-dimensional vectors
- Based on word features, n-grams, and text stats
- Not as good as AI, but works offline

## File Structure

```
src/
├── services/
│   └── EmbeddingService.ts      # NEW: All embedding logic
├── controllers/
│   └── Computation.ts            # Uses EmbeddingService
├── models/
│   └── EmbeddingsModel.ts        # Database operations
└── types/
    └── index.ts                  # Embedding type definition
```

## Environment Setup

### Required:
```bash
# .env
GCP_PROJECT_ID=your-project-id
```

### Dependencies:
```json
{
  "google-auth-library": "^9.0.0",
  "@google-cloud/vertexai": "^1.10.0"
}
```

### Install:
```bash
npm install
```

## Usage Examples

### Generate and Store Embedding:
```typescript
import { EmbeddingService } from './services/EmbeddingService';

const contentId = "abc123";
const text = "Professional enterprise solution";

const embedding = await EmbeddingService.generateAndStore(contentId, text);
// Returns: [0.23, 0.45, ..., 0.67] (768 numbers)
// Stores in database
```

### Calculate Similarity:
```typescript
const embedding1 = [0.23, 0.45, ...]; // Content A
const embedding2 = [0.24, 0.44, ...]; // Content B

const similarity = EmbeddingService.cosineSimilarity(embedding1, embedding2);
// Returns: 0.90 (90% similar)
```

### Generate Query Embedding:
```typescript
// For search queries (different task type)
const queryEmbedding = await EmbeddingService.generateQueryEmbedding("find professional content");
```

## How Validation Works

```
1. User generates content:
   POST /api/generate
   → Creates 3 text variants
   → Each gets an embedding stored

2. User validates content:
   POST /api/validate { "content_id": "abc123" }
   
3. System:
   a) Fetches content embedding from database
   b) Generates brand reference embeddings:
      - Theme tags: "modern, tech, clean"
      - Goals: "Increase brand awareness"
      - Description: "...project description..."
   c) Calculates similarity for each reference
   d) Averages scores → Brand Consistency Score
   
4. Returns:
   {
     "brand_consistency_score": 85,
     "similarity_details": {
       "theme_similarity": 88,
       "goals_similarity": 82,
       "description_similarity": 85
     }
   }
```

## Performance

### Vertex AI Embeddings:
- Speed: ~200-500ms per request
- Cost: ~$0.00001 per 1000 characters
- Quality: Excellent

### Fallback Embeddings:
- Speed: <10ms
- Cost: Free
- Quality: Adequate

## Limitations

### Current System Validates ONLY TEXT:
- Marketing copy
- Social media posts
- Email content
- Ad copy

### Does NOT Validate:
- Images
- Colors
- Fonts
- Visual design
- Video content

## Future Enhancements

1. **Semantic Search**: Find similar content across all projects
2. **Content Clustering**: Group similar content automatically
3. **Recommendation Engine**: Suggest content based on similarity
4. **Image Embeddings**: Add CLIP for visual consistency (separate feature)
5. **Caching**: Cache embeddings to reduce API calls
6. **Batch Processing**: Generate multiple embeddings in one call

## Troubleshooting

### Embeddings Not Generated:
```bash
# Check logs:
npm start

# Look for:
"No embedding returned from Vertex AI, using fallback"
"Failed to generate Vertex AI embedding"
```

### Authentication Issues:
```bash
# Verify GCP credentials:
echo $GCP_PROJECT_ID

# Check Application Default Credentials:
gcloud auth application-default login
```

### Wrong Dimensions:
- Vertex AI: 768 dimensions
- Fallback: 768 dimensions
- Both should match!

## Testing

```bash
# Run the validation test:
API_KEY=your-key PROJECT_ID=your-project node test-validate.js

# Expected output:
# "Step 1: Generating content..."
# "Step 2: Validating generated content..."
# "Brand Consistency: 85/100"
# "Quality Score: 90/100"
```

## Summary

**What embeddings do:**
- Convert text → numbers
- Measure semantic similarity
- Enable brand consistency checks

**What embeddings DON'T do:**
- Visual consistency
- Color matching
- Font validation
- Image generation

**Architecture:**
- Separate EmbeddingService
- Clean ComputationController
- Vertex AI with fallback
- 768-dimensional vectors

