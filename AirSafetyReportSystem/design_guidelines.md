# Air Safety Report System - Design Guidelines

## Design Approach

**Selected Framework**: Carbon Design System (IBM) with Fluent Design influences
**Rationale**: Enterprise aviation safety tool requiring data-heavy interfaces, complex forms, and professional trustworthiness. Carbon excels at information density while maintaining clarity.

**Core Principles**:
- Clarity over decoration - every element serves a purpose
- Professional restraint - avoid playful or trendy elements
- Information hierarchy - guide users through complex workflows
- Operational efficiency - minimize clicks, maximize clarity

---

## Typography System

**Primary Font**: Inter (via Google Fonts CDN)
**Secondary Font**: Roboto Mono (for technical data: flight numbers, timestamps, codes)

**Hierarchy**:
- Page Headers: text-3xl (30px), font-semibold, tracking-tight
- Section Headers: text-2xl (24px), font-semibold
- Subsection Headers: text-xl (20px), font-medium
- Form Labels: text-sm (14px), font-medium, uppercase tracking-wide
- Body Text: text-base (16px), font-normal, leading-relaxed
- Helper Text: text-sm (14px), text-gray-600, italic
- Technical Data: text-sm (14px), font-mono, tracking-tight
- Table Headers: text-xs (12px), font-semibold, uppercase tracking-wider
- Buttons: text-sm (14px), font-medium

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (form fields, icons): p-2, gap-2
- Component spacing (cards, sections): p-4, p-6, gap-4
- Page sections: p-8, p-12, gap-8
- Major separations: my-12, my-16

**Container Strategy**:
- App Shell: Full viewport with fixed sidebar (w-64)
- Main Content: max-w-7xl mx-auto px-6 lg:px-8
- Form Containers: max-w-4xl mx-auto
- Dashboard Grids: Full width with responsive breakpoints
- Data Tables: Full width with horizontal scroll if needed

**Grid Patterns**:
- Dashboard Stats: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6
- Report Cards: grid-cols-1 lg:grid-cols-2 gap-6
- Form Sections: Single column for clarity, grouped logically
- Review Comments: Single column, chronological

---

## Component Library

### Navigation
**Sidebar Navigation** (Desktop):
- Fixed left sidebar (w-64, h-screen)
- Logo/branding at top (h-16)
- Navigation items: py-3 px-4, text-sm, with icons (left-aligned)
- Active state: border-l-4, background treatment
- Grouped sections: Dashboard, Reports (expandable), User Management, Analytics, Settings
- User profile dropdown at bottom

**Mobile Navigation**:
- Collapsible hamburger menu
- Full-screen overlay when open
- Same grouping structure as desktop

### Dashboard Components

**Stat Cards**:
- Grid layout (4 columns desktop, 2 tablet, 1 mobile)
- Card structure: p-6, rounded-lg, border
- Large number: text-4xl font-bold
- Label: text-sm uppercase tracking-wide
- Icon in top-right corner (size-8)
- Trend indicator: small arrow icon + percentage

**Chart Containers**:
- Full-width cards with p-6
- Chart title: text-lg font-semibold mb-4
- Minimum height: h-80
- Legend positioned top-right or bottom-center

**Quick Actions Panel**:
- Horizontal button group
- Primary action buttons with icons
- "New Report" as prominent CTA

### Form Components

**Form Structure**:
- Clear section headers with dividing lines
- Grouped fields in logical sections (spacing: mb-8 between groups)
- Two-column layout only for short, related fields (e.g., Date/Time)
- All text inputs, textareas single column for consistency

**Input Fields**:
- Full width within container (w-full)
- Label above input: mb-2
- Input padding: px-4 py-2.5
- Border: border rounded-md
- Focus state: ring-2 ring-offset-1
- Error state: border-red-500 with error text below (text-sm text-red-600)
- Helper text: text-sm mt-1

**Select Dropdowns**:
- Consistent with text inputs
- Chevron icon on right
- Options list: max-h-60 overflow-y-auto

**Text Areas**:
- Minimum height: h-32 for descriptions
- Resize: resize-y (allow vertical resizing)
- Character counter if max length (bottom-right, text-xs)

**File Upload**:
- Dashed border container: border-2 border-dashed rounded-lg p-8
- Upload icon centered with text below
- "Drag & drop or click to upload"
- File type restrictions shown: text-xs
- Uploaded files list below with remove option
- Each file: name, size, remove icon

**Radio Buttons / Checkboxes**:
- Stacked vertically: space-y-3
- Label to right of input
- Group label above with mb-3

### Report Cards (Listing Page)

**Card Structure**:
- Border, rounded-lg, p-6
- Header row: Report type badge + date (justify-between)
- Report ID: text-sm font-mono
- Status badge: inline-block px-3 py-1 rounded-full text-xs font-medium
- Description preview: text-sm line-clamp-2 my-3
- Footer: Submitted by + View button (justify-between)

**Status Badges**:
- Submitted: Neutral treatment
- In Review: Warning treatment
- Closed: Success treatment
- Rejected: Error treatment

### Data Tables

**Table Structure**:
- Full width, responsive with horizontal scroll
- Header: sticky top-0 with subtle background
- Row padding: px-6 py-4
- Alternating row backgrounds for readability
- Hover state on rows
- Action column (right): icon buttons for view/edit/delete

**Table Cells**:
- Text alignment: left for text, right for numbers
- Truncate long text: truncate max-w-xs
- Technical data (IDs, codes): font-mono text-sm

### Comments/Activity Feed

**Comment Thread**:
- Vertical timeline with connecting line
- Each comment: mb-6
- Avatar (left) + content card
- Content card: border rounded-lg p-4
- Header: Name + timestamp (text-xs)
- Comment text: mt-2 text-sm
- Reply/Edit actions below if permitted

### Modals/Dialogs

**Structure**:
- Overlay: Fixed full-screen with semi-transparent background
- Modal container: max-w-2xl mx-auto mt-20
- Padding: p-6
- Header: text-xl font-semibold mb-4
- Close button: top-right corner
- Actions: bottom-right, gap-3 (Cancel + Primary action)

### Buttons

**Primary Actions**: px-6 py-2.5 rounded-md font-medium text-sm
**Secondary Actions**: Border variant, same sizing
**Icon Buttons**: p-2 rounded-md with icon (size-5)
**Text Buttons**: No border/background, underline on hover

---

## Page-Specific Layouts

### Dashboard
- No hero section - immediate data visibility
- Stats grid at top (full width)
- Two-column below: Left (2/3) charts, Right (1/3) recent activity
- "Quick Actions" panel above stats

### Report Forms
- Progress indicator if multi-step (top)
- Form title centered: mb-8
- Form sections with clear headings
- Sticky footer with Draft/Submit buttons
- Cancel returns to reports list

### Report Detail/Review
- Header section: Report type, ID, status (h-20)
- Three-column layout: Left (2/3) report content, Right (1/3) metadata + actions
- Comments section below content (full width)
- Review actions at bottom for Safety Officers

### Reports Listing
- Filters panel: horizontal bar with dropdowns (Type, Status, Date range, Search)
- Grid of report cards below
- Pagination at bottom

### User Management
- Data table view
- Add User button (top-right)
- Inline actions for edit/delete
- Modal for add/edit user form

### Analytics
- Exportable charts section
- Date range selector (top-right)
- Grid of visualization cards
- Export buttons per chart

---

## Images

**No hero images** - This is an enterprise application, not a marketing site.

**Icon System**: Use Heroicons (via CDN) exclusively
- Navigation icons: size-5
- Card header icons: size-8
- Button icons: size-4
- Form field icons: size-5

**Avatar Images**: User profile pictures in comments and headers (size-10 rounded-full)

**Attachment Thumbnails**: Document icons for uploaded files (size-12)

---

## Animations

**Minimal, purposeful only**:
- Dropdown menus: Simple fade-in (150ms)
- Modal appearance: Scale from 95% to 100% (200ms)
- Success notifications: Slide in from top (300ms)
- NO scroll animations, parallax, or decorative motion

---

## Responsive Behavior

**Breakpoints**:
- Mobile: < 768px (sm/md)
- Tablet: 768px - 1024px (md/lg)
- Desktop: > 1024px (lg/xl)

**Mobile Adaptations**:
- Sidebar becomes overlay menu
- Multi-column grids stack to single column
- Data tables: horizontal scroll with sticky first column
- Modal: full-screen on mobile (rounded corners only on desktop)
- Form spacing reduces: p-4 instead of p-6

---

**Key Distinction**: This is a professional safety tool, not a consumer product. Prioritize clarity, efficiency, and trust over visual flair.