# Design Guidelines: Unified Academic Document Generation Platform

## Design Approach

**Selected Approach:** Design System + Productivity Reference
- Primary inspiration: Linear's clean efficiency + Notion's content organization
- Core principle: Professional academic tool with modern productivity UX
- Focus: Clarity, efficiency, and trustworthy presentation

## Typography System

**Font Families:**
- Headings: Inter or system-ui (clean, professional)
- Body: Inter or system-ui (reading optimized)
- Code/Technical: JetBrains Mono (for document preview)

**Type Scale:**
- Hero/H1: text-4xl (36px) font-bold
- Section Headers/H2: text-2xl (24px) font-semibold
- Card Titles/H3: text-xl (20px) font-semibold
- Body Text: text-base (16px) font-normal
- Small Text: text-sm (14px)
- Labels: text-xs (12px) uppercase tracking-wide

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-6 or p-8
- Section spacing: gap-6 or gap-8
- Card margins: m-4
- Button padding: px-6 py-2

**Grid Structure:**
- Dashboard: 4-column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Generator workspace: 2-column split (input panel + preview)
- Mobile: Always single column stack

**Container Max-widths:**
- Dashboard sections: max-w-7xl
- Form containers: max-w-4xl
- Preview area: max-w-6xl

## Component Library

### Navigation
- **Top Navigation Bar:**
  - Fixed header with subtle shadow
  - Logo left, navigation center, user profile/auth right
  - Mobile: Hamburger menu with slide-out drawer
  - Height: h-16

### Dashboard/Home Page
- **Hero Section:**
  - Centered layout with gradient background
  - Main headline describing platform purpose
  - Subtext explaining 4 document types
  - Primary CTA: "Get Started" or "Choose Document Type"
  - No large hero image - focus on content and action

- **Document Type Cards (4 cards):**
  - Grid layout: 4 columns desktop, 2 columns tablet, 1 column mobile
  - Each card contains:
    - Icon (large, 64px) representing document type
    - Title (Report / PowerPoint / Conference Paper / Thesis)
    - 2-3 line description
    - "Generate" button
    - Feature count badge (e.g., "10+ Features")
  - Card styling: Elevated with subtle shadow, rounded-lg
  - Hover: Slight scale transform and deeper shadow

### Generator Workspace
- **Layout:** Split screen design
  - Left panel (40%): Input controls and settings
  - Right panel (60%): Live preview iframe
  - Mobile: Stacked with tabs to switch views

- **Input Panel Components:**
  - Template selector: Radio cards with visual indicators
  - Text input: Large textarea with character counter
  - File upload: Drag-and-drop zone with file list
  - Settings accordion: Collapsible sections for:
    - Length selector (dropdown)
    - Tone selector (button group)
    - Citation style (toggle)
    - Formatting options (sliders/dropdowns)
  - "Surprise Me" button: Outlined style with icon
  - Primary "Generate" button: Full width, prominent

### Forms & Inputs
- **Text Fields:**
  - Border: border with rounded corners
  - Focus state: Ring treatment (ring-2)
  - Labels: Above input, font-medium

- **Buttons:**
  - Primary: Solid fill with white text
  - Secondary: Outlined with transparent background
  - Sizes: Large (py-3 px-8), Medium (py-2 px-6), Small (py-1 px-4)

- **Dropdowns/Selects:**
  - Custom styled with chevron icon
  - Options list with hover states

### Preview & Display
- **Document Preview:**
  - Sandboxed iframe with A4 aspect ratio
  - Zoom controls: Fit to width, 100%, 150%
  - Toolbar above preview: Export buttons (PDF/DOCX/PPTX/HTML)

- **Progress Indicators:**
  - Linear progress bar with percentage
  - Status text below: "Generating content..." / "Fetching images..."
  - Spinner for indeterminate states

### Project Management
- **My Projects Section:**
  - List/Grid toggle view
  - Each project card:
    - Document type badge
    - Title
    - Creation date
    - Actions: Load, Delete (icon buttons)
  - Search/filter bar at top
  - Empty state: Centered message with CTA

### Modals/Dialogs
- **Authentication Modal:**
  - Centered overlay with backdrop blur
  - Google OAuth button (icon + text)
  - Email/password form below
  - Tabs: Sign In / Sign Up
  - Close button (top right)

- **Settings Modal:**
  - API key configuration fields
  - Save/Cancel button group

## Responsive Behavior

**Breakpoints:**
- Mobile: < 640px (base styles)
- Tablet: 640px - 1024px (md:)
- Desktop: > 1024px (lg:)

**Mobile Adaptations:**
- Navigation: Hamburger menu
- Dashboard: Single column card stack
- Generator: Tabbed interface (Input / Preview tabs)
- Buttons: Full width on mobile
- Text: Slightly smaller scales (text-3xl → text-2xl for headings)

## Visual Hierarchy

**Emphasis Strategy:**
- Primary actions: High contrast, larger size
- Secondary actions: Outlined or ghost style
- Tertiary actions: Icon-only or text links
- Active document type: Highlighted border/shadow
- Generate button: Most prominent element in workspace

## Status & Feedback

**Loading States:**
- Skeleton screens for content loading
- Spinner with descriptive text
- Progress bars for multi-step generation

**Success/Error States:**
- Toast notifications (top-right corner)
- Inline validation messages (below inputs)
- Success: Green accent
- Error: Red accent with icon

## Images

**Dashboard:**
- No large hero image
- Document type cards use icon illustrations (not photos)
- Optional: Small decorative abstract shapes in background

**Generator Workspace:**
- Preview area shows generated document with embedded images
- No decorative images in input panel - focus on functionality

## Professional Polish

- Consistent rounded corners (rounded-lg for cards, rounded-md for inputs)
- Subtle shadows for depth (shadow-sm for cards, shadow-md for modals)
- Smooth transitions on interactive elements (transition-all duration-200)
- Accessible focus states on all interactive elements
- Professional academic aesthetic - avoid overly colorful or playful design
- Trust indicators: Powered by Google Gemini, Firebase security badges