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

- **ContentGenerationPipeline: prompt validation and edge-case handling**
  - Files: `src/services/ContentGenerationPipeline.ts`, tests in `tests/contentGenerationPipeline.unit.test.ts`
  - Issues:
    - Missing prompt validation allowed empty/non-string prompts to proceed, conflicting with tests expecting rejection.
    - When generation returned no variants (e.g., `variantCount=0`), the pipeline continued scoring/analysis and ranking, leading to undefined contents and incorrect averages.
    - `rankVariants` length could mismatch the number of generated variants, causing boundary tests to fail and potential truncation/expansion issues.
  - Fixes:
    - Added prompt validation to throw on non-string or empty prompts.
    - Added early return path when no variants are generated, returning empty variants with correct metadata (averageQuality=0, averageCompositeScore=0) and diversity computed on empty.
    - Normalized ranking length to match generated variants and adjusted averageCompositeScore calculation accordingly.

## Summary of API test Bug Findings & Fixes

- **ThemeController: validation and normalization in create**
  - Files: `src/controllers/ThemeController.ts`, tests in `tests/theme.api.test.ts`, `tests/themeController.unit.test.ts`
  - Issues:
    - Requests with minimal names (e.g., `"a"`) triggered `TypeError` during analysis when optional fields were missing or malformed.
    - `tags` could be missing, empty, or not an array, leading to inconsistent records and analysis errors.
    - `inspirations` could be non-iterable, causing runtime failures in `ThemeAnalysisService.analyzeTheme`.
  - Fixes:
    - Require `tags` to be a non-empty array for theme creation; return 400 when invalid.
    - Normalize `inspirations` to an array: if missing or not an array, default to `[]` before persistence.

---

