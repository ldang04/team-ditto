# Content Validation API

## Overview
The `/api/validate` endpoint analyzes marketing content against your brand guidelines using **embedding similarity** and quality heuristics. This fast, deterministic approach compares content semantically with your brand's theme, goals, and style.

## Endpoint
```
POST /api/validate
```

## Authentication
Requires API key in Authorization header:
```
Authorization: Bearer YOUR_API_KEY
```

## Request Body

You can validate content in two ways:

### Option 1: Validate Existing Content
```json
{
  "content_id": "uuid-of-existing-content"
}
```

### Option 2: Validate Raw Content
```json
{
  "content": "Your marketing content text here...",
  "project_id": "uuid-of-project"
}
```

## Response Format

```json
{
  "success": true,
  "content_id": "uuid-or-null",
  "project_id": "uuid",
  "validation": {
    "brand_consistency_score": 85,
    "quality_score": 90,
    "overall_score": 87,
    "passes_validation": true,
    "strengths": [
      "Aligns well with modern tech theme",
      "Professional tone matches target audience"
    ],
    "issues": [
      {
        "severity": "minor",
        "category": "brand_alignment",
        "description": "Could emphasize brand inspirations more",
        "suggestion": "Reference key features that align with Apple/Google design principles"
      }
    ],
    "recommendations": [
      "Consider adding a clear call-to-action",
      "Emphasize unique value proposition"
    ],
    "summary": "Content aligns well with brand guidelines with minor improvements possible",
    "similarity_details": {
      "theme_similarity": 85,
      "inspiration_similarity": 78,
      "description_similarity": 82,
      "goals_similarity": 88,
      "audience_similarity": 80
    }
  },
  "timestamp": "2025-10-23T02:44:37.486Z"
}
```

## Validation Metrics

### Brand Consistency Score (0-100)
**Calculated using embedding similarity:**
- Generates vector embeddings for your content
- Compares with embeddings of:
  - Theme name and tags
  - Brand inspirations
  - Project description
  - Project goals
  - Target customer type
- Averages cosine similarity scores
- Score = average similarity × 100

**Why embeddings?**
- ⚡ **Fast**: No LLM calls required
- 💰 **Cheap**: Just vector math
- 🎯 **Deterministic**: Same content = same score
- 📊 **Quantitative**: Objective similarity measurement

### Quality Score (0-100)
**Calculated using text heuristics:**
- Content length (optimal: 20-200 words)
- Sentence structure (multiple sentences preferred)
- Average word length (5-8 characters)
- Professional vocabulary usage
- Punctuation patterns (detects excessive !!!)
- Capitalization (detects ALL CAPS)

### Overall Score (0-100)
Weighted average:
- **60% Brand Consistency** (embedding similarity)
- **40% Quality Score** (text heuristics)

### Passes Validation
- `true` if overall_score >= 70
- `false` if overall_score < 70

### Similarity Details
Breakdown of how your content aligns with specific brand elements:
- `theme_similarity`: Alignment with theme name/tags
- `inspiration_similarity`: Similarity to brand inspirations
- `description_similarity`: Match with project description
- `goals_similarity`: Alignment with project goals
- `audience_similarity`: Targeting correct audience

## Issue Severity Levels

- **critical**: Major problems that must be fixed before publishing
- **major**: Important issues that significantly impact effectiveness
- **minor**: Small improvements that would enhance the content

## Issue Categories

- **brand_alignment**: Content doesn't match brand guidelines
- **tone**: Inappropriate tone for target audience
- **grammar**: Spelling or grammatical errors
- **clarity**: Unclear or confusing messaging
- **other**: Miscellaneous issues

## Example Usage

### cURL Example
```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "content": "Check out our amazing new product!",
    "project_id": "f51d5060-f23f-4742-8830-bc8ea84d24f1"
  }'
```

### JavaScript/Node.js Example
```javascript
const response = await fetch('http://localhost:3000/api/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    content: 'Introducing our latest innovation designed for tech professionals.',
    project_id: 'f51d5060-f23f-4742-8830-bc8ea84d24f1'
  })
});

const result = await response.json();
console.log('Validation Score:', result.validation.overall_score);
console.log('Passes:', result.validation.passes_validation);
```

### Python Example
```python
import requests

response = requests.post(
    'http://localhost:3000/api/validate',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
    },
    json={
        'content': 'Introducing our latest innovation designed for tech professionals.',
        'project_id': 'f51d5060-f23f-4742-8830-bc8ea84d24f1'
    }
)

result = response.json()
print(f"Overall Score: {result['validation']['overall_score']}")
print(f"Passes: {result['validation']['passes_validation']}")
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Must provide either content_id OR (content + project_id)"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing API key"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid API key"
}
```

### 404 Not Found
```json
{
  "error": "Content not found"
}
// or
{
  "error": "Project not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Content validation failed",
  "details": "error message"
}
```

## Use Cases

### 1. Pre-Publication Review
Validate content before publishing to ensure brand consistency:
```javascript
// Generate content
const generated = await generateContent({ project_id, prompt });

// Validate each variant
for (const variant of generated.variants) {
  const validation = await validateContent({
    content_id: variant.content_id
  });
  
  if (validation.validation.passes_validation) {
    console.log('[PASS] Ready to publish');
  } else {
    console.log('[FAIL] Needs revision:', validation.validation.issues);
  }
}
```

### 2. Batch Content Audit
Review all content for a project:
```javascript
// Get all content for project
const contents = await getProjectContent(project_id);

// Validate each piece
const results = await Promise.all(
  contents.map(c => validateContent({ content_id: c.id }))
);

// Filter failing content
const failing = results.filter(r => !r.validation.passes_validation);
console.log(`${failing.length} items need attention`);
```

### 3. Real-Time Validation
Validate user input as they type:
```javascript
const debounceValidate = debounce(async (content, project_id) => {
  const result = await validateContent({ content, project_id });
  updateUI(result.validation);
}, 1000);

textArea.addEventListener('input', (e) => {
  debounceValidate(e.target.value, currentProjectId);
});
```

## Tips for Best Results

1. **Provide Context**: Use projects with detailed descriptions and well-defined themes
2. **Set Clear Guidelines**: Define specific brand tags and inspirations
3. **Iterative Improvement**: Use recommendations to refine content
4. **Consistent Standards**: Apply validation across all content for uniformity
5. **Monitor Trends**: Track scores over time to identify patterns

## Related Endpoints

- `POST /api/generate` - Generate AI content variants
- `POST /api/rank` - Rank multiple content variants (coming soon)
- `POST /api/audit` - Comprehensive content audit (coming soon)

