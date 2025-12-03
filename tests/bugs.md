# Test Bug Findings

This document lists issues discovered while auditing and augmenting tests across the codebase, describes what was done to fix them.

## Summary of Unit test Bug Findings & Fixes

- **Controllers lacked trimming/validation for names**
  - Files: `src/controllers/ProjectController.ts`, `src/controllers/ClientController.ts`
  - Issue: Controllers allowed whitespace-only `name` values (truthy) which is semantically invalid.
  - Fix: Implemented trimming and validation so `name` is trimmed and controllers return 400 when trimmed name is empty. Tests were updated accordingly.

- **ProjectController.update: whitespace-only id handling**
  - File: `src/controllers/ProjectController.ts`
  - Issue: `update` initially accepted whitespace-only `id`. The controller was changed to reject whitespace-only ids.
  - Fix: Updated tests to expect 400 for whitespace-only `id`. 

- **EmbeddingService: fallback on empty embedding responses**
  - Files: `src/services/EmbeddingService.ts`
  - Issue: `generateQueryEmbedding` and `generateImageEmbedding` previously returned empty arrays when the remote Vertex AI API returned an empty embedding payload. This caused downstream code to see zero-length embeddings.
  - Fix: Service functions now detect empty embeddings returned by the API and use the deterministic local `generateFallbackEmbedding` instead. 

---

Generated on: 2025-12-03
