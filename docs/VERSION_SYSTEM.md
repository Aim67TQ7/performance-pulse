# Version System - Database Schema & Architecture

## Overview

This document describes the database schema, tables, and edge functions required for the multi-application versioning system as defined in REVISIONINGRULES.md.

---

## Database Schema

### Table: `app_revisions`

Stores all application revisions with full history. Each revision is linked to a specific application via `app_id`.

```sql
CREATE TABLE public.app_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES public.app_items(id) ON DELETE CASCADE,
  version TEXT NOT NULL,           -- Format: x.y.z (e.g., "1.2.3")
  major INTEGER NOT NULL,
  minor INTEGER NOT NULL,
  patch INTEGER NOT NULL,
  revision_type TEXT NOT NULL CHECK (revision_type IN ('MAJOR', 'MINOR', 'PATCH')),
  description TEXT NOT NULL,
  release_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT false,
  released_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique version per app
  UNIQUE(app_id, version)
);

-- Ensure only one current version PER APP at a time
CREATE UNIQUE INDEX idx_app_revisions_current_per_app 
ON public.app_revisions (app_id) 
WHERE is_current = true;

-- Index for version lookups by app
CREATE INDEX idx_app_revisions_app_version 
ON public.app_revisions (app_id, major DESC, minor DESC, patch DESC);

-- Enable RLS
ALTER TABLE public.app_revisions ENABLE ROW LEVEL SECURITY;

-- Everyone can read revisions
CREATE POLICY "Anyone can view revisions" 
ON public.app_revisions 
FOR SELECT 
USING (true);

-- Only admins can insert/update revisions
CREATE POLICY "Admins can manage revisions" 
ON public.app_revisions 
FOR ALL 
USING (has_role(auth.uid(), 'admin')) 
WITH CHECK (has_role(auth.uid(), 'admin'));
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| app_id | UUID | Foreign key to app_items.id |
| version | TEXT | Full version string (e.g., "1.2.3") |
| major | INTEGER | Major version number |
| minor | INTEGER | Minor version number |
| patch | INTEGER | Patch version number |
| revision_type | TEXT | Type: MAJOR, MINOR, or PATCH |
| description | TEXT | Short description of changes |
| release_date | TIMESTAMPTZ | When the version was released |
| is_current | BOOLEAN | Whether this is the active version |
| released_by | UUID | User who released this version |
| created_at | TIMESTAMPTZ | Record creation timestamp |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        app_items                                │
│  (all BuntingGPT applications)                                  │
├─────────────────────────────────────────────────────────────────┤
│ id: 2a0d5058-eb46-4ecc-af8c-d5ec2df8cd7b                        │
│ name: Customer & Prospects - BMC                                │
│ url: https://prospector.buntinggpt.com                          │
├─────────────────────────────────────────────────────────────────┤
│ id: 02ca319b-a7d0-4a5e-a8b6-b3b2df294072                        │
│ name: Performance Self-Review                                   │
│ url: https://self.buntinggpt.com                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ FK: app_id
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       app_revisions                             │
├─────────────────────────────────────────────────────────────────┤
│ app_id │ version │ type   │ description              │ current  │
├────────┼─────────┼────────┼──────────────────────────┼──────────┤
│ 2a0d...│ 1.0.0   │ MAJOR  │ Initial release          │ true     │
│ 2a0d...│ 1.1.0   │ MINOR  │ Added filters            │ false    │
│ 02ca...│ 1.0.0   │ MAJOR  │ Initial release          │ true     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Edge Functions

### 1. get-app-version

Returns the current application version and optionally the full revision history for a specific app.

**Endpoint:** `GET /functions/v1/get-app-version?app_id=<uuid>`

**Query Parameters:**
- `app_id` (required): UUID of the application
- `include_history` (optional): If `true`, includes full revision history

**Response:**

```json
{
  "current": {
    "version": "1.2.3",
    "revision_type": "MINOR",
    "description": "Added customer search filters",
    "release_date": "2025-01-15T10:30:00Z"
  },
  "history": [
    {
      "version": "1.2.3",
      "revision_type": "MINOR",
      "description": "Added customer search filters",
      "release_date": "2025-01-15T10:30:00Z"
    },
    {
      "version": "1.2.2",
      "revision_type": "PATCH",
      "description": "Fixed map marker clustering",
      "release_date": "2025-01-10T14:00:00Z"
    }
  ]
}
```

---

## Frontend Components

### Required Components

1. **VersionBadge** (`src/components/version/VersionBadge.tsx`)
   - Small clickable version display
   - Positioned beneath app title
   - Opens revision history on click

2. **RevisionHistoryDialog** (`src/components/version/RevisionHistoryDialog.tsx`)
   - Modal showing full revision history
   - Color-coded by revision type:
     - MAJOR: Red
     - MINOR: Blue
     - PATCH: Green
   - Sorted newest first

3. **useAppVersion** (`src/hooks/useAppVersion.ts`)
   - React hook to fetch version data
   - Caches result
   - Returns `{ version, history, isLoading }`

---

## Adding a New Version

To add a new version for any application:

```sql
-- First, unset current flag for the app
UPDATE public.app_revisions 
SET is_current = false 
WHERE app_id = '<app-uuid>' AND is_current = true;

-- Then insert the new version
INSERT INTO public.app_revisions (
  app_id,
  version,
  major, minor, patch,
  revision_type,
  description,
  is_current
) VALUES (
  '<app-uuid>',
  '1.1.0',
  1, 1, 0,
  'MINOR',
  'Added new feature X',
  true
);
```

---

## Validation Rules

1. Only one revision per app can have `is_current = true`
2. Version format must be `x.y.z`
3. `revision_type` must match the version change:
   - MAJOR: major incremented, minor/patch reset to 0
   - MINOR: minor incremented, patch reset to 0
   - PATCH: only patch incremented
4. Description is required and should be user-friendly
