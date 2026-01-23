# Performance Evaluation Portal (PEP)

A modern, streamlined employee self-assessment platform designed for annual performance reviews. Built with React, TypeScript, and Supabase.

## 🎯 Value Proposition

**For Employees:**
- Guided 4-section wizard makes self-assessment intuitive and stress-free
- Auto-save functionality ensures no work is lost
- Professional PDF generation for records and signatures
- Clear progress tracking throughout the evaluation process

**For Managers:**
- Real-time visibility into team completion status via hierarchical dashboard
- One-click "Poke Team" reminders to drive completion rates
- Direct PDF viewing of submitted assessments
- Collapsible org chart view for easy navigation

**For HR Administrators:**
- Centralized management of competencies, employees, and settings
- CSV bulk import for employee data
- Customizable performance competencies with definitions
- Complete audit trail and submission tracking

## 📋 Self-Assessment Structure

| Section | Content |
|---------|---------|
| **I. Employee Information** | Auto-populated employee details and reporting hierarchy |
| **II. Quantitative Self-Assessment** | Performance objectives table with measurable targets, actuals, and calculated scores |
| **III. Performance Competencies** | Self-ratings (1-5) and comments on core competencies (Teamwork, Attitude, Quality, Accountability, Innovation, Development) |
| **IV. Employee Summary** | Work accomplishments narrative and final review |

## 🔐 Authentication

Cross-subdomain SSO supporting:
- **Standalone mode**: Cookie-based authentication with redirect to login hub
- **Embedded mode**: PostMessage token exchange for iframe integration
- Shared sessions across `*.buntinggpt.com` subdomains

## 🏗️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **PDF Generation**: pdf-lib with branded templates
- **State Management**: TanStack Query, React Context

## 📁 Project Structure

```
src/
├── components/
│   ├── admin/           # HR admin components (CompetencyManager, EmployeeManager, etc.)
│   ├── evaluation/      # Wizard steps and evaluation UI
│   ├── ui/              # shadcn/ui component library
│   └── version/         # Version tracking components
├── contexts/            # Auth and app-wide state
├── hooks/               # Custom React hooks
├── lib/                 # Utilities (PDF generator, CSV parser, cookie storage)
├── pages/               # Route components
└── types/               # TypeScript definitions
```

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🔧 Environment Variables

The app connects to Supabase project `qzwxisdfwswsrbzvpzlo`. Authentication cookies are scoped to `.buntinggpt.com` for cross-subdomain sharing.

## 📄 Key Features

- **Auto-save**: Evaluation progress is automatically saved as users complete each section
- **PDF Export**: Professional branded documents with cover page, section formatting, and signature lines
- **Reopen Workflow**: Managers can reopen submitted evaluations for revisions
- **Competency Management**: HR can add, edit, and reorder performance competencies
- **Hierarchy Visualization**: Interactive org chart showing reporting relationships
- **Error Logging**: Built-in error capture for debugging evaluation issues

## 📖 Documentation

Additional documentation available in `/docs`:
- `AUTH.md` - Authentication architecture
- `subdomain-auth.md` - Cross-subdomain SSO implementation
- `VERSION_SYSTEM.md` - App versioning strategy
- `REVISIONINGRULES.md` - Evaluation revision workflows

---

Built by Bunting Magnetics Co.
