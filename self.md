# Performance Evaluation Portal (PEP) — Technical Specification

> **Version:** 1.2.0  
> **Last Updated:** January 2026  
> **Status:** Production

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Authentication System](#authentication-system)
5. [Database Schema](#database-schema)
6. [Edge Functions (Backend)](#edge-functions-backend)
7. [Frontend Application](#frontend-application)
8. [Self-Assessment Workflow](#self-assessment-workflow)
9. [PDF Generation](#pdf-generation)
10. [Security Model](#security-model)
11. [Deployment](#deployment)

---

## Overview

The Performance Evaluation Portal (PEP) is a web-based employee self-assessment platform enabling salaried employees to complete annual performance evaluations. The system supports:

- **Employees**: Complete guided self-assessments with auto-save and PDF export
- **Managers**: View direct report evaluation status and completed PDFs
- **HR Administrators**: Manage employees, competencies, and view company-wide evaluation progress

### Key Features

| Feature | Description |
|---------|-------------|
| Multi-step wizard | 4-section guided evaluation form |
| Auto-save | Real-time localStorage + database sync |
| PDF generation | Client-side PDF creation using pdf-lib |
| Hierarchy visualization | Org tree for managers and HR admins |
| Custom authentication | Email/password auth without external providers |
| Competency management | Admin-configurable performance competencies |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (React SPA)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ │
│  │  Dashboard  │ │ Evaluation  │ │ Team Status │ │   HR Admin    │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └───────┬───────┘ │
│         │               │               │                 │         │
│         └───────────────┴───────────────┴─────────────────┘         │
│                                 │                                    │
│                    ┌────────────┴────────────┐                       │
│                    │     AuthContext         │                       │
│                    │  (JWT Token Storage)    │                       │
│                    └────────────┬────────────┘                       │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │ HTTPS + Bearer Token
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions (Deno)                   │
│  ┌─────────────┐ ┌───────────────────┐ ┌──────────────────────────┐ │
│  │employee-auth│ │submit-evaluation  │ │   team-hierarchy         │ │
│  │  /login     │ │  /save            │ │  /hierarchy              │ │
│  │  /set-pass  │ │  /submit          │ │  /company-hierarchy      │ │
│  │  /verify    │ │  /fetch           │ │  /check-subordinates     │ │
│  └──────┬──────┘ └─────────┬─────────┘ └────────────┬─────────────┘ │
│         │                  │                        │               │
│         └──────────────────┴────────────────────────┘               │
│                            │ Service Role Key (bypasses RLS)        │
└────────────────────────────┼────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                              │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│  │  employees   │  │  pep_evaluations │  │  pep_competencies   │   │
│  │  (users)     │  │  (assessments)   │  │  (rating criteria)  │   │
│  └──────────────┘  └──────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User authenticates via `employee-auth` edge function
2. JWT token stored in localStorage (`pep_auth_token`)
3. Authenticated requests include `Authorization: Bearer <token>`
4. Edge functions verify JWT and use service role key to bypass RLS
5. Direct Supabase client used only for read-only public queries

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.x | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| TailwindCSS | 3.x | Styling |
| shadcn/ui | Latest | Component library |
| TanStack Query | 5.x | Server state management |
| React Router | 6.x | Client-side routing |
| pdf-lib | 1.17.x | PDF generation |

### Backend (Supabase)

| Component | Purpose |
|-----------|---------|
| PostgreSQL | Primary database |
| Edge Functions | Serverless API (Deno) |
| Storage | PDF file storage (planned) |

### Key Libraries

```json
{
  "@supabase/supabase-js": "^2.89.0",
  "@tanstack/react-query": "^5.83.0",
  "pdf-lib": "^1.17.1",
  "react-router-dom": "^6.30.1",
  "zod": "^3.25.76"
}
```

---

## Authentication System

### Overview

PEP uses **cross-subdomain SSO authentication** via gate.buntinggpt.com with:
- Microsoft Azure OAuth via Supabase Auth at the gate
- Chunked cookie session storage for cross-subdomain sharing
- Session data stored in `bunting-auth-token` cookies on `.buntinggpt.com`
- Employee lookup from the `employees` table based on email

### Legacy Authentication (Backup)

The legacy custom email-based authentication system is preserved in `AuthContext.legacy.tsx`:
- Uses the `employees` table directly as the user database
- Issues custom JWTs signed with HMAC-SHA256
- Stores passwords using PBKDF2 (100,000 iterations, SHA-256)

### SSO Authentication Flow

```
┌─────────────────┐         ┌─────────────────────┐         ┌──────────────┐
│   self.app      │         │  gate.buntinggpt.com │         │  Supabase    │
│ (PEP client)    │         │  (SSO Gateway)       │         │  Auth        │
└────────┬────────┘         └──────────┬──────────┘         └──────┬───────┘
         │                             │                           │
         │  Not authenticated?         │                           │
         │  Redirect to gate           │                           │
         │────────────────────────────►│                           │
         │                             │  OAuth redirect           │
         │                             │──────────────────────────►│
         │                             │                           │
         │                             │  Microsoft Azure OAuth    │
         │                             │◄──────────────────────────│
         │                             │                           │
         │                             │  Set chunked cookies      │
         │                             │  on .buntinggpt.com       │
         │                             │                           │
         │  Redirect back + cookies    │                           │
         │◄────────────────────────────│                           │
         │                             │                           │
         │  Read cookies, lookup       │                           │
         │  employee by email          │                           │
         │                             │                           │
```

### Cookie Chunking System

Large session data is automatically split across multiple cookies:

| Scenario | Behavior |
|----------|----------|
| Small session (< 3800 bytes) | Single `bunting-auth-token` cookie |
| Large session (> 3800 bytes) | Split into `bunting-auth-token.0`, `.1`, etc. + `.count` |
| Reading session | Check for `.count` first, reassemble if chunked, else read single |
| Sign out | Delete single cookie + all chunks + count |

### Cookie Attributes

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `path` | `/` | Available across all paths |
| `domain` | `.buntinggpt.com` | Cross-subdomain sharing (production only) |
| `max-age` | `31536000` | 1 year expiry |
| `SameSite` | `Lax` | Security protection |
| `Secure` | `true` | HTTPS only (production) |

### Session Data Structure

```typescript
interface GateSession {
  access_token: string;           // Supabase JWT
  refresh_token?: string;         // For token refresh
  expires_at?: number;            // Expiry timestamp
  user: {
    id: string;                   // Supabase user UUID
    email: string;                // User email
    user_metadata?: {
      full_name?: string;         // From OAuth provider
      name?: string;
      avatar_url?: string;
    };
  };
}
```

### Cookie Session Utilities (`src/lib/cookieSession.ts`)

```typescript
// Read session from cookies (handles chunked and single)
readSession<T>(): T | null

// Write session to cookies (auto-chunks if needed)
writeSession<T>(data: T): void

// Clear all session cookies
clearSession(): void

// Check if a session exists
hasSession(): boolean
```

---

## Database Schema

### Core Tables

#### `employees`

The central user/employee table.

```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_first VARCHAR NOT NULL,
  name_last VARCHAR NOT NULL,
  user_email VARCHAR UNIQUE,
  job_title VARCHAR,
  department VARCHAR,
  job_level job_level,  -- ENUM: Employee, Supervisor, Manager, Director, VP, Executive
  location VARCHAR,
  business_unit VARCHAR,
  benefit_class VARCHAR,  -- 'salary' for evaluation eligibility
  hire_date DATE,
  employee_number VARCHAR,
  badge_number VARCHAR,
  reports_to UUID REFERENCES employees(id),
  is_active BOOLEAN DEFAULT true,
  is_hr_admin BOOLEAN DEFAULT false,
  
  -- Authentication fields
  badge_pin_hash VARCHAR,           -- PBKDF2 password hash
  badge_pin_is_default BOOLEAN,     -- Force password change flag
  badge_pin_attempts INTEGER,       -- Failed login counter
  badge_pin_locked_until TIMESTAMP, -- Lockout expiry
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

#### `pep_evaluations`

Stores self-assessment data.

```sql
CREATE TABLE pep_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) NOT NULL,
  supervisor_id UUID REFERENCES employees(id),
  manager_id UUID REFERENCES employees(id),
  period_year INTEGER NOT NULL,
  
  -- Status tracking
  status evaluation_status DEFAULT 'draft',
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  signed_at TIMESTAMP,
  reopened_at TIMESTAMP,
  reopened_by UUID REFERENCES employees(id),
  reopen_reason TEXT,
  
  -- Assessment data (JSON columns)
  employee_info_json JSONB,
  quantitative_json JSONB,
  qualitative_json JSONB,
  summary_json JSONB,
  
  -- PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(employee_id, period_year)
);
```

#### `pep_competencies`

Admin-configurable competency definitions.

```sql
CREATE TABLE pep_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  definition TEXT NOT NULL,
  observable_behaviors TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Data Types

```typescript
// Evaluation status lifecycle
type EvaluationStatus = 'draft' | 'submitted' | 'reviewed' | 'signed' | 'reopened';

// Overall rating scale
type OverallRating = 
  | 'exceptional'        // 5 - Always performs beyond requirements
  | 'excellent'          // 4 - Consistently effective, no weaknesses
  | 'fully_satisfactory' // 3 - Expected performance for the position
  | 'marginal'           // 2 - Below average in some major areas
  | 'unacceptable'       // 1 - Does not meet expectations
  | 'cannot_evaluate';   // N/A - Insufficient information

// Job level hierarchy
type JobLevel = 'Employee' | 'Supervisor' | 'Manager' | 'Director' | 'VP' | 'Executive';
```

---

## Edge Functions (Backend)

All edge functions are located in `supabase/functions/`.

### `employee-auth`

**Purpose:** Custom authentication system

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/login` | POST | Authenticate with email/password |
| `/set-password` | POST | Set or change password |
| `/verify-token` | POST | Validate JWT and refresh employee data |

**Key Logic:**
- Verifies PBKDF2 password hashes
- Issues HMAC-SHA256 signed JWTs
- Handles account lockout after failed attempts
- Supports first-time password setup flow

### `submit-evaluation`

**Purpose:** CRUD operations for evaluations (bypasses RLS)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/fetch` | GET | Get employee's evaluation for a period |
| `/save` | POST | Create/update evaluation draft |
| `/submit` | POST | Submit evaluation (status → submitted) |
| `/reopen` | POST | Reopen submitted evaluation (managers) |

**Authorization:** Requires valid JWT with `employee_id` claim

### `team-hierarchy`

**Purpose:** Organizational hierarchy queries

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/check-subordinates` | GET | Check if user has direct reports |
| `/hierarchy` | GET | Get manager's team hierarchy with eval status |
| `/company-hierarchy` | GET | Get full company hierarchy (HR Admin only) |

**Authorization:** 
- `/hierarchy`: Any authenticated user
- `/company-hierarchy`: Requires `is_hr_admin: true` in JWT

### `manage-employees`

**Purpose:** Employee CRUD for HR Admins

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/create` | POST | Create new employee |
| `/update` | PUT | Update employee data |
| `/delete` | DELETE | Delete employee |

**Authorization:** Requires `is_hr_admin: true` in JWT

---

## Frontend Application

### Route Structure

```typescript
// src/App.tsx
<Routes>
  {/* Public */}
  <Route path="/login" element={<Login />} />
  
  {/* Protected */}
  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/evaluation" element={<ProtectedRoute><Evaluation /></ProtectedRoute>} />
  <Route path="/team-status" element={<ProtectedRoute><TeamStatus /></ProtectedRoute>} />
  <Route path="/hr-admin" element={<ProtectedRoute><HRAdmin /></ProtectedRoute>} />
  
  <Route path="*" element={<NotFound />} />
</Routes>
```

### Key Components

#### Authentication

| Component | Purpose |
|-----------|---------|
| `AuthContext` | Global auth state provider (SSO via gate.buntinggpt.com) |
| `AuthContext.legacy` | Backup custom email/password auth |
| `ProtectedRoute` | Route guard, redirects to gate for SSO |
| `Login` | SSO redirect handler |
| `cookieSession` | Chunked cookie read/write utilities |

#### Evaluation Wizard

| Component | Purpose |
|-----------|---------|
| `EvaluationWizard` | Multi-step form container |
| `EmployeeInfoStep` | Step 1: Employee details |
| `QuantitativeStep` | Step 2: Performance objectives |
| `CompetenciesStep` | Step 2b: Competency ratings |
| `QualitativeStep` | Step 3: Qualitative factors |
| `SummaryStep` | Step 4: Summary & ratings |
| `SuccessScreen` | Post-submission confirmation |

#### Admin Components

| Component | Purpose |
|-----------|---------|
| `EmployeeManager` | CRUD interface for employees |
| `CompetencyManager` | Manage competency definitions |
| `HierarchyTree` | Org chart visualization |

### State Management

#### AuthContext (`src/contexts/AuthContext.tsx`)

```typescript
interface AuthContextType {
  employee: Employee | null;      // Current user data (from employees table)
  employeeId: string | null;      // UUID shortcut
  isLoading: boolean;             // Initial auth check
  isAuthenticated: boolean;       // Valid session
  tempToken: string | null;       // Not used with SSO (always null)
  token: string | null;           // Supabase access token from gate
  session: GateSession | null;    // Full session from gate cookies
  signIn: () => void;             // Redirect to gate for SSO
  signOut: () => void;            // Clear cookies + redirect to gate signout
  // Legacy methods (redirect to gate)
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  setPassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; error?: string }>;
}
```

#### useEvaluation Hook (`src/hooks/useEvaluation.ts`)

Central hook for evaluation state management:

- Loads existing evaluation from database
- Falls back to localStorage for unsaved drafts
- Provides update methods with auto-save
- Handles PDF generation and submission
- Syncs employee info changes to employees table

---

## Self-Assessment Workflow

### Assessment Structure

The evaluation consists of 4 sections completed in order:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Employee Information                                   │
│  - Name, Title, Department                                      │
│  - Period Year (hardcoded: 2025)                                │
│  - Supervisor (auto-populated from reports_to)                  │
└───────────────────────────────────┬─────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Quantitative Self-Assessment                           │
│  - Performance Objectives (goal/target/actual)                  │
│  - Work Accomplishments (text)                                  │
│  - Performance Competencies (6 categories, 1-5 scale)          │
│  - Overall Quantitative Rating                                  │
└───────────────────────────────────┬─────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Qualitative Factors                                    │
│  - Planning & Organization (5 factors)                          │
│  - Interpersonal Skills (5 factors)                             │
│  - Individual Competencies (5 factors)                          │
│  All rated on 1-5 Likert scale                                 │
└───────────────────────────────────┬─────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Employee Summary                                        │
│  - Employee Summary (text)                                       │
│  - Targets for Next Year (text)                                 │
│  - Qualitative Rating                                           │
│  - Overall Rating                                               │
└───────────────────────────────────┬─────────────────────────────┘
                                    ▼
                              [SUBMIT]
                                    │
                                    ▼
                         PDF Generated & Stored
```

### Status Lifecycle

```
draft ──────► submitted ──────► reviewed ──────► signed
   │              │
   │              │ (manager can reopen)
   │              ▼
   └─────── reopened
```

### Auto-Save Strategy

```typescript
// Dual-save approach for reliability
1. localStorage.setItem(STORAGE_KEY, data)  // Immediate
2. POST /submit-evaluation/save              // Async to database

// On page load:
if (localStorage.lastSaved > db.updated_at) {
  use localStorage data  // Recover unsaved changes
} else {
  use database data
}
```

---

## PDF Generation

### Overview

PDFs are generated client-side using `pdf-lib` to:
- Avoid server processing costs
- Enable offline generation
- Provide instant preview

### PDF Structure

1. **Cover Page**: Logo, title, employee name, period
2. **Employee Information**: Name, title, department, supervisor
3. **Performance Objectives**: Table of goals/targets/actuals
4. **Competency Ratings**: 6 competencies with 1-5 scores
5. **Qualitative Factors**: 15 factors in 3 categories
6. **Summary & Ratings**: Final comments and overall ratings

### Branding

```typescript
const COLORS = {
  primaryRed: rgb(0.89, 0.106, 0.137),   // #E31B23 (Bunting red)
  burgundy: rgb(0.545, 0.122, 0.255),     // #8B1F41
  darkGray: rgb(0.176, 0.176, 0.176),     // #2D2D2D
  // ...
};
```

### File Naming

```
PEP_John_Doe_2025.pdf
```

---

## Security Model

### Row-Level Security (RLS)

RLS is **enabled** on all tables but edge functions bypass it using the service role key. This ensures:

- Direct Supabase client access is blocked for writes
- All mutations go through authenticated edge functions
- Edge functions verify JWT claims before operations

### Access Control Matrix

| Resource | Employee | Manager | HR Admin |
|----------|----------|---------|----------|
| Own evaluation | Read/Write | Read/Write | Read/Write |
| Team evaluations | - | Read | Read |
| All evaluations | - | - | Read |
| Employees table | Read self | Read team | Full CRUD |
| Competencies | Read | Read | Full CRUD |

### JWT Verification Pattern

All edge functions follow this pattern:

```typescript
// Extract token
const authHeader = req.headers.get("Authorization");
const token = authHeader.replace("Bearer ", "");

// Verify with WebCrypto HMAC-SHA256
const { valid, payload } = await verifyJWT(token);

if (!valid || !payload.employee_id) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}

// Use service role client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### Sensitive Data Handling

| Data | Protection |
|------|------------|
| Passwords | PBKDF2-SHA256 (100K iterations) |
| JWTs | HMAC-SHA256 signature |
| Employee emails | Stored plaintext (no PII encryption) |
| PDFs | Supabase Storage (authenticated access) |

---

## Deployment

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Build-time | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Build-time | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Bypass RLS |
| `JWT_SECRET` | Edge Functions | Token signing (fallback: service key) |

### Supabase Edge Functions

Deployed via Supabase CLI:

```bash
# Manual deployment
supabase functions deploy employee-auth
supabase functions deploy submit-evaluation
supabase functions deploy team-hierarchy
supabase functions deploy manage-employees
```

---

## Appendix

### File Structure

```
src/
├── components/
│   ├── admin/           # HR Admin components
│   ├── evaluation/      # Wizard steps
│   ├── ui/              # shadcn/ui primitives
│   └── version/         # Version display
├── contexts/
│   └── AuthContext.tsx  # Authentication provider
├── hooks/
│   ├── useAuth.ts       # Auth hook wrapper
│   ├── useEvaluation.ts # Evaluation state
│   └── useErrorLogger.ts
├── lib/
│   ├── pdfGenerator.ts  # PDF creation
│   └── utils.ts         # Tailwind merge utilities
├── pages/
│   ├── Dashboard.tsx
│   ├── Evaluation.tsx
│   ├── HRAdmin.tsx
│   ├── Login.tsx
│   ├── SetPassword.tsx
│   └── TeamStatus.tsx
├── types/
│   └── evaluation.ts    # TypeScript interfaces
└── integrations/
    └── supabase/        # Auto-generated types

supabase/
├── functions/
│   ├── employee-auth/
│   ├── manage-employees/
│   ├── submit-evaluation/
│   └── team-hierarchy/
└── migrations/          # Database migrations
```

### Assessment Year

The current assessment period is **hardcoded** in `useEvaluation.ts`:

```typescript
const ASSESSMENT_YEAR = 2025;
```

Changing this requires updating:
1. `src/hooks/useEvaluation.ts` - `ASSESSMENT_YEAR` constant
2. Any cached localStorage data must be cleared

---

*End of Technical Specification*
