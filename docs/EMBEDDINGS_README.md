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

### 1. Content Generation (`/api/text/generate`)
- Generates marketing text with AI using a 9-stage pipeline
- Uses **Advanced Hybrid RAG** to find relevant context from previous content
- Controller stores content and generates embeddings after pipeline completes
- Embeddings stored in database for later validation/RAG retrieval

### 2. RAG (Retrieval-Augmented Generation)
- Finds relevant past content to improve generation quality
- Uses **Hybrid Search**: combines BM25 keyword matching + semantic embeddings
- Uses **Reciprocal Rank Fusion (RRF)** to merge rankings
- Uses **MMR (Maximal Marginal Relevance)** for diverse results
- Returns context that makes AI generations more brand-consistent

### 3. Content Validation (`/api/validate`)
- Compares content embedding to brand embeddings
- Calculates similarity scores
- Returns: "85% brand consistent"

## Architecture

### Current Architecture:
```
ContentGenerationPipeline (9-stage pipeline)
├── Stage 1: Theme Analysis (parallel)
├── Stage 2: RAG Retrieval (parallel) ← Uses RAGService
├── Stage 3: Prompt Enhancement
├── Stage 4: Quality Prediction
├── Stage 5: AI Generation (Vertex AI)
├── Stage 6: Quality Scoring
├── Stage 7: Content Analysis (marketing metrics)
├── Stage 8: Diversity Analysis (semantic)
└── Stage 9: Variant Ranking

RAGService (Advanced Hybrid Search)
├── BM25 keyword scoring (TF-IDF based)
├── Semantic embedding search
├── Reciprocal Rank Fusion (RRF)
├── Maximal Marginal Relevance (MMR)
└── Configurable parameters (RAGConfig)

EmbeddingService (separate service)
├── Generate document embeddings
├── Generate query embeddings
├── Store embeddings
├── Calculate similarity
└── Fallback embedding generation

ContentAnalysisService (marketing analysis)
├── Marketing readability (power words, CTAs, scannability)
├── Marketing tone (urgency, benefits, social proof, emotion)
├── Brand keyword density
└── Semantic diversity scoring
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

## Advanced RAG System (2025)

The RAG (Retrieval-Augmented Generation) system uses state-of-the-art techniques for finding relevant context.

### Hybrid Search Architecture

```
User Query: "professional tech landing page"
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   BM25 Scoring            Semantic Search
   (keyword match)         (embedding similarity)
        │                       │
        └───────────┬───────────┘
                    ▼
          Reciprocal Rank Fusion (RRF)
                    │
                    ▼
          Maximal Marginal Relevance (MMR)
                    │
                    ▼
            Top-K Diverse Results
```

### BM25 (Best Matching 25)
Probabilistic retrieval using TF-IDF weighting:

```typescript
BM25(q, d) = Σ IDF(qi) × (tf(qi, d) × (k1 + 1)) / (tf(qi, d) + k1 × (1 - b + b × |d|/avgdl))
```

**Parameters:**
- `k1` (default: 1.5): Term frequency saturation
- `b` (default: 0.75): Length normalization factor

**Benefits:**
- Exact keyword matching
- Handles rare/important terms well
- Fast computation

### Reciprocal Rank Fusion (RRF)
Combines multiple ranking methods without score normalization:

```typescript
RRF(d) = Σ 1 / (k + rank_i(d))
```

**Parameters:**
- `k` (default: 60): Smoothing constant

**Benefits:**
- Score-agnostic fusion
- Robust to outliers
- Simple yet effective

### Maximal Marginal Relevance (MMR)
Balances relevance with diversity:

```typescript
MMR = argmax[λ × Sim(d, q) - (1-λ) × max(Sim(d, selected))]
```

**Parameters:**
- `lambda` (default: 0.7): Balance between relevance (1.0) and diversity (0.0)

**Benefits:**
- Reduces redundancy
- Ensures diverse context
- Configurable trade-off

### RAG Configuration

```typescript
interface RAGConfig {
  candidatePoolSize: number;  // default: 20 (initial pool for MMR)
  topK: number;               // default: 5 (final results)
  mmrLambda: number;          // default: 0.7 (relevance vs diversity)
  rrfK: number;               // default: 60 (RRF smoothing)
  bm25: {
    k1: number;               // default: 1.5 (term saturation)
    b: number;                // default: 0.75 (length norm)
  };
}
```

### RAG Context Response

```typescript
interface RAGContext {
  relevantContents: Content[];      // Retrieved content items
  similarDescriptions: string[];    // Extracted descriptions
  themeEmbedding: number[];        // Theme vector
  avgSimilarity: number;           // Average similarity score
  method: "hybrid" | "semantic" | "bm25" | "theme_only";
  metrics?: {
    bm25TopScore: number;          // Best BM25 score
    semanticTopScore: number;      // Best semantic score
    hybridTopScore: number;        // Best combined score
    diversityScore: number;        // MMR diversity metric
  };
}
```

### Method Selection

The RAG service automatically selects the best method:

| Scenario | Method | Reason |
|----------|--------|--------|
| Has theme + prior content | `hybrid` | Full BM25 + semantic + RRF + MMR |
| Has theme, no content | `theme_only` | Uses theme embedding only |
| Semantic search fails | `bm25` | Falls back to keyword matching |
| BM25 fails | `semantic` | Falls back to embedding similarity |

## File Structure

```
src/
├── services/
│   ├── EmbeddingService.ts           # Embedding generation & storage
│   ├── RAGService.ts                 # Advanced hybrid RAG (BM25, RRF, MMR)
│   ├── ContentGenerationPipeline.ts  # 9-stage generation pipeline
│   ├── ContentAnalysisService.ts     # Marketing content analysis
│   └── PromptEnhancementService.ts   # AI prompt optimization
├── controllers/
│   ├── TextController.ts             # Text generation endpoints
│   └── ValidationController.ts       # Content validation endpoints
├── models/
│   ├── EmbeddingsModel.ts            # Embeddings database operations
│   └── ContentModel.ts               # Content database operations
└── types/
    └── index.ts                      # Type definitions
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
   POST /api/text/generate
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

1. ~~**Semantic Search**: Find similar content across all projects~~ ✅ Implemented via RAGService
2. **Content Clustering**: Group similar content automatically
3. **Recommendation Engine**: Suggest content based on similarity
4. **Image Embeddings**: Add CLIP for visual consistency (separate feature)
5. **Caching**: Cache embeddings to reduce API calls
6. **Batch Processing**: Generate multiple embeddings in one call
7. **Cross-encoder Reranking**: Two-stage retrieval with neural rerankers
8. **Query Expansion**: Automatic query term expansion for better recall

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
- Power hybrid RAG for content generation

**What embeddings DON'T do:**
- Visual consistency
- Color matching
- Font validation
- Image generation

**Architecture:**
- 9-stage ContentGenerationPipeline
- Advanced RAGService (BM25 + Semantic + RRF + MMR)
- Separate EmbeddingService
- ContentAnalysisService for marketing metrics
- Vertex AI with fallback
- 768-dimensional vectors

