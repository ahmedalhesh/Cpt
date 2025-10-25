# Air Safety Report System

## Project Overview
A comprehensive aviation safety reporting platform designed to replace paper-based forms with a secure, digital system for airline pilots and safety officers. The application enables efficient incident reporting, workflow management, and safety compliance.

## Current Status
**Phase**: Task 1 - Schema & Frontend Implementation (In Progress)
**Last Updated**: October 24, 2025

## System Architecture

### Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL (Neon)
- **Authentication**: Replit Auth (OpenID Connect)
- **State Management**: React Query (TanStack Query v5)
- **Forms**: React Hook Form with Zod validation
- **Routing**: Wouter
- **Date Handling**: date-fns

### Database Schema

#### Tables
1. **users** - User accounts with role-based access
   - Roles: captain, safety_officer, administrator
   - Replit Auth integration (id, email, firstName, lastName, profileImageUrl)

2. **sessions** - Authentication session storage (Replit Auth requirement)

3. **reports** - Main reports table storing all 7 report types
   - Types: asr, or, rir, ncr, cdf, chr
   - Status: submitted, in_review, closed, rejected
   - Fields customized per report type
   - Support for anonymous reporting (CHR)

4. **comments** - Discussion threads on reports
   - Links users to reports for follow-up communication

5. **attachments** - File attachments for reports
   - Supports PDF, JPG, DOCX, PNG

### Report Types

1. **ASR** - Air Safety Report
   - Flight operations safety events
   - Fields: flight number, aircraft type, route, event details, corrective actions

2. **OR** - Occurrence Report
   - Operational/technical occurrences
   - Fields: location, phase of flight, risk level, follow-up actions

3. **RIR** - Ramp Incident Report
   - Ground handling incidents
   - Fields: ground crew, vehicles, damage type, corrective steps

4. **NCR** - Nonconformity Report
   - Procedural/safety standard violations
   - Fields: department, nonconformity type, root cause, preventive actions

5. **CDF** - Commander's Discretion Form
   - Flight commander decisions outside standard limits
   - Fields: discretion reason, time extensions, crew fatigue, final decision

6. **CHR** - Confidential Hazard Report
   - Anonymous hazard reporting for safety awareness
   - Fields: hazard description, potential impact, prevention suggestions
   - **Special**: Supports anonymous submission

### User Roles & Permissions

#### Captain
- Create all report types
- View own reports
- Comment on reports
- Read-only access to other reports

#### Safety Officer
- All Captain permissions
- Review and update report status
- Access all reports
- Workflow management (Submitted → In Review → Closed/Rejected)

#### Administrator
- All Safety Officer permissions
- User management capabilities
- System configuration access

### Frontend Pages

#### Public (Logged Out)
- **Landing Page** (`/`) - Marketing page with login button

#### Protected (Logged In)
- **Dashboard** (`/`) - Stats cards, quick actions, report breakdowns
- **All Reports** (`/reports`) - List view with filtering and search
- **Report Detail** (`/reports/:id`) - Full report view with comments and workflow actions
- **New Report Forms** (`/reports/new/:type`) - 7 different report forms
  - `/reports/new/asr` - Air Safety Report
  - `/reports/new/or` - Occurrence Report
  - `/reports/new/rir` - Ramp Incident Report
  - `/reports/new/ncr` - Nonconformity Report
  - `/reports/new/cdf` - Commander's Discretion Form
  - `/reports/new/chr` - Confidential Hazard Report

### Key Components

#### Layout & Navigation
- **AppSidebar** - Role-based sidebar navigation with user profile
- **SidebarProvider** - Layout wrapper with collapsible sidebar

#### Display Components
- **StatCard** - Dashboard statistics cards
- **ReportTypeBadge** - Visual indicators for report types
- **StatusBadge** - Report status indicators (color-coded)
- **RoleBadge** - User role display

#### Form Components
- **ReportForm** - Unified form component handling all 7 report types
- Dynamic field rendering based on report type
- Zod validation schemas per type
- Anonymous submission support (CHR)

### Design System

#### Colors (Aviation Theme)
- **Primary**: Blue (212 95% 32%) - Professional aviation blue
- **Secondary**: Gray variants for backgrounds
- **Status Colors**:
  - Submitted: Secondary (neutral)
  - In Review: Primary (active)
  - Closed: Outline (completed)
  - Rejected: Destructive (error)

#### Typography
- **Primary Font**: Inter
- **Monospace**: Roboto Mono (for technical data like flight numbers, IDs)
- **Hierarchy**: Follows design_guidelines.md specifications

#### Spacing
- Small: p-2, p-4, gap-2, gap-4
- Medium: p-6, gap-6
- Large: p-8, p-12, gap-8

### API Endpoints (To Be Implemented)

#### Authentication
- `GET /api/auth/user` - Get current user
- `GET /api/login` - Initiate login (Replit Auth)
- `GET /api/logout` - Logout user
- `GET /api/callback` - OAuth callback (Replit Auth)

#### Reports
- `GET /api/reports` - List reports (with filters)
- `GET /api/reports/:id` - Get report details
- `POST /api/reports` - Create new report
- `PATCH /api/reports/:id/status` - Update report status
- `GET /api/reports/stats` - Dashboard statistics

#### Comments
- `GET /api/comments?reportId=:id` - Get comments for report
- `POST /api/comments` - Add comment to report

#### Attachments
- `POST /api/attachments` - Upload file attachment
- `GET /api/attachments/:id` - Download attachment

### Workflow States

```
Submitted → In Review → Closed
                     ↘ Rejected
```

- **Submitted**: Initial state when report created
- **In Review**: Safety officer reviewing (safety_officer/admin only)
- **Closed**: Report resolved (safety_officer/admin only)
- **Rejected**: Report rejected (safety_officer/admin only)

### Security & Authentication

- **Replit Auth** integration with OpenID Connect
- Session-based authentication with PostgreSQL storage
- Role-based access control on routes
- Unauthorized error handling at page and endpoint levels
- Secure file upload validation

### Development Guidelines

#### Code Organization
- Components in `/client/src/components`
- Pages in `/client/src/pages`
- Shared types in `/shared/schema.ts`
- Hooks in `/client/src/hooks`
- Utilities in `/client/src/lib`

#### Best Practices
- Follow design_guidelines.md for all UI implementations
- Use Shadcn UI components consistently
- Implement proper loading and error states
- Add data-testid attributes for testing
- Use React Query for all API calls
- Never expose secrets or API keys
- Validate all form inputs with Zod

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `REPL_ID` - Replit application ID
- `REPLIT_DOMAINS` - Allowed domains for OAuth
- `ISSUER_URL` - OIDC issuer URL (optional)

### Next Steps

1. **Task 2 - Backend Implementation**
   - Set up Replit Auth
   - Implement all API endpoints
   - Create database with Drizzle ORM
   - File upload handling
   - Role-based permission middleware

2. **Task 3 - Integration & Testing**
   - Connect frontend to backend
   - Test all workflows
   - Error handling and loading states
   - End-to-end testing
   - Final polish and optimization

### Notes
- Design follows Carbon/Fluent enterprise patterns
- Emphasis on professional aviation industry aesthetics
- Mobile-responsive design throughout
- Accessibility considerations in all components
- Future: Analytics, PDF export, bilingual support, dark mode
