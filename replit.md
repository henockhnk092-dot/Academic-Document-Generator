# PaperGen AI - Academic Document Generator

## Overview

PaperGen AI is a unified platform for generating professional academic documents using AI. The application supports four document types: technical reports (BET-standard), PowerPoint presentations, conference papers (IEEE format), and thesis/dissertations (Harvard citations). Built with a React frontend and Express backend, it leverages Google Gemini 2.5 Flash for content generation and Pixabay API for image sourcing. The platform features file upload processing (PDF, DOCX, images), real-time preview, and multi-format export capabilities (DOCX, PDF, PPTX).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and bundler.

**UI System**: Shadcn/ui component library with Radix UI primitives, styled with Tailwind CSS. The design follows a "Design System + Productivity Reference" approach inspired by Linear and Notion, emphasizing clean efficiency and professional academic presentation.

**Routing**: Wouter for lightweight client-side routing with the following structure:
- `/` - Home page with document type selection
- `/projects` - Document history and project management
- `/templates` - Templates library with 8 default academic templates
- `/references` - Reference library for managing sources and citations
- `/ai-assistant` - AI writing assistant with chat and grammar checker
- `/analytics` - Usage analytics dashboard
- `/generate/report` - Technical report generator
- `/generate/powerpoint` - Presentation generator
- `/generate/conference` - Conference paper generator
- `/generate/thesis` - Thesis/dissertation generator
- `/about` - About page with feature overview
- `/contact` - Contact form page
- `/settings` - User preferences and API key configuration

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and cache invalidation. Local component state managed with React hooks.

**Key Design Patterns**:
- Shared `GeneratorLayout` component for consistent UI across all document generators
- Custom hooks for reusable logic (`useDocumentGenerator`, `useFileUpload`, `useProjectManagement`)
- Form-based input with tabbed interface (text input vs file upload)
- Real-time progress tracking during generation

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**API Structure**: RESTful API endpoints organized by feature:

Document Generation:
- `POST /api/generate/report` - Generate technical reports
- `POST /api/generate/powerpoint` - Generate presentations
- `POST /api/generate/conference` - Generate conference papers
- `POST /api/generate/thesis` - Generate thesis documents

File Processing:
- `POST /api/files/process` - Extract text from uploaded files
- `POST /api/images/search` - Search Pixabay for images
- `POST /api/images/random` - Get random topic-relevant image

Project & Document Management:
- `GET/POST /api/projects` - List and create projects
- `GET/PUT/DELETE /api/projects/:id` - Manage individual projects
- `GET/POST /api/documents` - List and create documents
- `GET/DELETE /api/documents/:id` - Manage individual documents

Templates Library:
- `GET /api/templates` - List all templates (default + custom)
- `POST /api/templates/:id/use` - Use a template and increment usage count

Reference Management:
- `GET/POST /api/references` - List and create references
- `DELETE /api/references/:id` - Delete a reference
- `POST /api/citations/format` - Format a reference using AI (supports APA, MLA, Chicago, IEEE, Harvard)

AI Writing Assistant:
- `POST /api/ai/session` - Create new AI chat session
- `POST /api/ai/chat` - Send message to AI and get response
- `POST /api/ai/grammar` - Check text for grammar/style issues
- `POST /api/ai/grammar/:id/apply` - Apply a grammar suggestion

Analytics:
- `GET /api/analytics/:userId` - Get usage summary and recent events
- `GET /api/languages` - List supported languages for multi-language generation

**File Processing**: Multer for multipart/form-data handling with in-memory storage (10MB limit). Supports PDF extraction (using pdfjs-dist) and DOCX extraction (using mammoth).

**Document Export**: DOCX generation using the `docx` library with support for complex academic formatting (headings, citations, tables, images).

**Development vs Production**:
- Development: Vite dev server with HMR integrated into Express
- Production: Serves static built files from `dist/public`

### Data Storage

**Current Implementation**: PostgreSQL database with Drizzle ORM for persistent storage. Data is stored across the following tables:
- `projects` - User projects with documents
- `documents` - Generated academic documents
- `templates` - Reusable document templates
- `references` - User's reference library
- `citations` - Formatted citations for references
- `ai_sessions` - AI writing assistant chat sessions
- `ai_messages` - Messages within AI sessions
- `grammar_suggestions` - Grammar check suggestions
- `analytics_events` - Usage tracking and analytics
- `user_subscriptions` - Stripe subscription management

**Schema Definition**: Drizzle ORM schemas with Zod validation for type-safe API handling. All models use the `createInsertSchema` pattern with proper validation.

### Authentication & Authorization

**Planned Implementation**: Firebase Authentication infrastructure present but not yet active:
- Google Sign-In provider configuration
- Email/password authentication scaffolding
- `AuthDialog` component built but returns mock responses
- User ID currently hardcoded as "demo-user"

**Future State**: When activated, will use Firebase Auth for user sessions and Firestore for document persistence with user-scoped queries.

## Freemium Model & Stripe Integration

### Usage Limits
- **Guest users**: 3 free document generations (tracked in localStorage)
- **Logged-in users**: 5 free document generations (tracked in database)
- **Subscribers**: Unlimited generations during subscription period

### Subscription Tiers (via Stripe)
- **Day Pass**: $1 one-time purchase (24 hours unlimited)
- **Weekly**: $3/week recurring subscription
- **Monthly**: $10/month recurring subscription
- **Yearly**: $99/year recurring subscription (best value)

### Stripe Integration Architecture
- **stripe-replit-sync**: Handles webhook setup and Stripe data synchronization
- **Products/Prices**: Created via Stripe API, fetched directly from Stripe for display
- **Checkout Flow**: Creates Stripe Checkout sessions with dynamic mode (subscription/payment)
- **Webhook Events**: Handles product.created, price.created, subscription updates

### Key Components
- `client/src/components/usage-gate.tsx`: Renders usage limits and pricing modal trigger
- `client/src/components/pricing-modal.tsx`: Displays subscription tiers from Stripe
- `client/src/hooks/use-usage.ts`: Manages usage tracking and limits
- `server/stripeService.ts`: Stripe API wrapper for products, checkout, and subscriptions
- `server/stripeClient.ts`: Stripe client initialization with connector credentials
- `server/webhookHandlers.ts`: Webhook registration with stripe-replit-sync

### Security Note
Production deployment should implement Firebase Admin SDK for server-side token verification in the checkout endpoint to prevent user identity spoofing.

## External Dependencies

### AI Services

**Google Gemini 2.5 Flash**: Primary content generation engine accessed via `@google/genai` SDK. Used for:
- Structured academic content generation with configurable temperature (0.7 default)
- JSON response format support for structured data
- System instructions for domain-specific formatting
- Token limit: 8192 max output tokens

**Configuration**: Requires `GEMINI_API_KEY` environment variable. Graceful degradation with error messaging when not configured.

### Image Services

**Pixabay API**: Photo search and retrieval for document illustrations. Features:
- Keyword extraction from topics (filters generic terms, focuses on technical keywords)
- Safe search enabled
- Returns high-quality images with multiple resolution URLs
- Fallback to empty array when API key not configured

**Configuration**: Requires `PIXABAY_API_KEY` environment variable.

### Firebase (Planned)

**Services Prepared**:
- Firebase Authentication for user management
- Cloud Firestore for document storage
- Configuration using environment variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`

**Current Status**: SDK initialized but authentication flows return mock data. Project management uses local memory storage instead of Firestore.

### Database

**Drizzle ORM**: Active with PostgreSQL via Neon Database serverless driver (`@neondatabase/serverless`). Uses `npm run db:push` for schema synchronization. Requires `DATABASE_URL` environment variable which is auto-configured.

**New Features Added**:
- **Templates Library**: 8 default academic templates (IEEE Conference Paper, Harvard Thesis, Technical Report, Business Presentation, Research Proposal, Lab Report, Academic Essay, Pitch Deck)
- **Reference Library**: Store and manage research sources with tags and notes
- **Citation Manager**: Format citations in 5 styles (APA, MLA, Chicago, IEEE, Harvard) using Gemini AI
- **AI Writing Assistant**: Chat-based writing help and grammar checking powered by Gemini AI
- **Grammar Checker**: Analyze text for grammar, style, and clarity issues with apply suggestions
- **Analytics Dashboard**: Track document generation patterns and usage statistics
- **Multi-language Support**: Generate documents in 10+ languages via Gemini AI

### Build & Development Tools

- **Vite**: Frontend build tool with React plugin and development server
- **TypeScript**: Type safety across frontend and backend with shared types in `/shared`
- **ESBuild**: Backend bundling for production builds
- **PostCSS & Autoprefixer**: CSS processing pipeline
- **Tailwind CSS**: Utility-first styling with custom design tokens

### UI Component Libraries

- **Radix UI**: Accessible, unstyled component primitives (dialogs, dropdowns, tabs, etc.)
- **Lucide React**: Icon library
- **React Hook Form**: Form state management with Zod validation
- **Embla Carousel**: Carousel/slider functionality
- **Recharts**: Chart rendering (prepared for data visualization features)