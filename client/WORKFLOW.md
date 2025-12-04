# BrandForge Studio - Workflow-Based Architecture

## Overview

The application has been restructured to follow a **workflow-based architecture** that enforces prerequisites and guides users through the proper setup sequence.

## Workflow Sequence

The application follows this mandatory workflow:

1. **Create Client** (Login) → Get API key
2. **Create Theme** → Define brand guidelines (required)
3. **Create Project** → Link to theme (required for generation)
4. **Generate Content** → Text or images (requires project with theme)
5. **Validate Content** → Check brand compliance

## Key Changes

### 1. Workflow Validation Utilities (`src/utils/workflow.ts`)

- `analyzeWorkflowStatus()`: Analyzes current setup status
- `isProjectReadyForGeneration()`: Validates if a project can generate content

### 2. Workflow Wizard Component

- Guided onboarding for new users
- Step-by-step theme and project creation
- Visual progress indicators
- Auto-advances through workflow steps

### 3. Dashboard Restructuring

- Shows workflow progress at a glance
- Displays only "ready" projects (with themes)
- Workflow status cards showing completion
- Automatic wizard for incomplete setup

### 4. Generation Pages with Validation

**Text & Image Generation:**
- Only shows projects with themes in dropdown
- Validates project before allowing generation
- Shows workflow blockers if prerequisites missing
- Clear error messages explaining what's needed

### 5. Project Creation Enforcement

- Theme field is now **required**
- Visual indicators show project readiness
- Warning messages for projects without themes
- Cannot create project without theme

### 6. Visual Status Indicators

- ✅ Green checkmarks for ready projects
- ⚠️ Yellow warnings for incomplete setup
- Progress bars showing workflow completion
- Status cards on dashboard

## Prerequisites

### Text Generation Requires:
- ✅ Project (with `project_id`)
- ✅ Theme linked to project (`theme_id`)
- ✅ Theme must exist in database

### Image Generation Requires:
- ✅ Project (with `project_id`)
- ✅ Theme linked to project (`theme_id`)
- ✅ Theme must exist in database
- ✅ Uses theme for RAG, prompt enhancement, and style analysis

### Validation Requires:
- ✅ Project with `theme_id`
- ✅ Project with `customer_type` (not null)

## Error Prevention

The workflow structure prevents common errors:

1. **No theme selection** → Cannot create project
2. **Project without theme** → Cannot generate content
3. **Invalid project** → Validation before API calls
4. **Missing prerequisites** → Clear workflow blockers shown

## User Experience Flow

### New User Journey:
1. Login/Create account
2. Auto-shown workflow wizard
3. Create theme (Step 1)
4. Create project with theme (Step 2)
5. Ready to generate content

### Existing User Journey:
- Dashboard shows current status
- Workflow blockers guide to missing steps
- Only ready projects shown in generation pages
- Clear indicators of what's complete

## Technical Implementation

### Workflow Status Analysis
```typescript
const status = analyzeWorkflowStatus(themes, projects);
// Returns: hasTheme, hasProject, hasProjectWithTheme, currentStep, isReady
```

### Project Validation
```typescript
const validation = isProjectReadyForGeneration(project);
// Returns: { ready: boolean, missing: string[] }
```

### Workflow Blockers
- Component shows when prerequisites missing
- Provides direct links to fix issues
- Explains why each step is needed

## Benefits

1. **Prevents API Errors**: Users can't hit 404 errors from missing themes
2. **Clear Guidance**: Always know what's next
3. **Better UX**: Progressive disclosure of features
4. **Data Integrity**: Enforces proper relationships
5. **Onboarding**: Smooth first-time experience

## Migration Notes

Existing users with projects without themes will:
- See warnings on dashboard
- Cannot generate content until theme added
- Guided to edit projects to add themes
- Projects shown but marked as "not ready"

