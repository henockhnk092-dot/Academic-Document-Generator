# AcademicGen - AI-Powered Academic Document Generator

<p align="center">
  <img src="https://academicgen.com/og-image.png" alt="AcademicGen Banner" width="800">
</p>

<p align="center">
  <strong>Generate professional academic documents in seconds using artificial intelligence</strong>
</p>

<p align="center">
  <a href="https://academicgen.com">
    <img src="https://img.shields.io/badge/🌐_Live_Demo-academicgen.com-blue?style=for-the-badge" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/Powered_by-Google_Gemini_2.5-4285F4?style=for-the-badge&logo=google" alt="Powered by Gemini">
  <img src="https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Document Types](#-document-types)
- [Technology Stack](#-technology-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Component Documentation](#-component-documentation)
- [Hooks Documentation](#-hooks-documentation)
- [Database Schema](#-database-schema)
- [Authentication](#-authentication)
- [Deployment](#-deployment)
- [Usage Guide](#-usage-guide)
- [Contributing](#-contributing)
- [Author](#-author)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🎯 Overview

**AcademicGen** is a comprehensive, free, AI-powered web application designed to revolutionize the way students, researchers, and professionals create academic documents. The platform leverages Google's Gemini 2.5 Flash AI model to generate high-quality, professionally formatted documents in seconds.

### The Problem

Academic writing presents significant challenges:
- **Time-consuming formatting** - Hours spent on document structure instead of content
- **Complex citation requirements** - Different styles (APA, MLA, IEEE, Harvard, Chicago)
- **Consistency issues** - Maintaining formatting across lengthy documents
- **Technical barriers** - LaTeX equations, Gantt charts, budget tables

### The Solution

AcademicGen automates the entire document creation process:
- Enter your topic or upload reference materials
- Select your document type and preferences
- AI generates a complete, professionally formatted document
- Export to your preferred format (DOCX, PDF, PPTX, HTML)

---

## 🌐 Live Demo

**Production URL:** [https://academicgen.com](https://academicgen.com)

The platform is fully functional and free to use. No account required for basic usage (3 free generations). Sign in with Google for extended access (5 free generations) or purchase a membership for unlimited access.

---

## ✨ Features

### Core Features

| Feature | Description |
|---------|-------------|
| **AI Document Generation** | Powered by Google Gemini 2.5 Flash for intelligent, context-aware content creation |
| **Multiple Document Types** | Technical reports, presentations, conference papers, thesis documents, custom reports |
| **Real-time Preview** | Watch your document generate live with streaming AI responses |
| **Multiple Export Formats** | DOCX, PPTX, PDF, HTML, BibTeX, RIS, CSV, PNG, JPEG, WEBP |
| **Citation Management** | Support for APA, MLA, Chicago, Harvard, and IEEE citation styles |
| **File Upload Processing** | Extract content from PDF, DOCX, TXT files and images |
| **AI Image Generation** | Create custom images from text descriptions using Pollinations.ai |
| **Reference Library** | Smart citation import from URLs, DOIs, and BibTeX files |
| **Cloud Storage** | Save projects to Firebase Firestore with Google authentication |
| **AI Chatbot Assistant** | Built-in assistant to guide users and answer questions |

### User Experience Features

| Feature | Description |
|---------|-------------|
| **Responsive Design** | Fully responsive from 320px mobile to ultra-wide desktop monitors |
| **Dark/Light Mode** | Theme toggle with system preference detection |
| **Keyboard Shortcuts** | Efficient navigation and actions |
| **Text-to-Speech** | Listen to AI responses with browser TTS |
| **Copy to Clipboard** | One-click copy for generated content |
| **Progress Indicators** | Visual feedback during generation |
| **Toast Notifications** | User-friendly success/error messages |
| **Persistent Chat History** | LocalStorage-based chat message persistence |

### Technical Features

| Feature | Description |
|---------|-------------|
| **LaTeX Rendering** | KaTeX integration for mathematical equations |
| **Markdown Processing** | Rich text formatting in AI responses |
| **Image Integration** | Automatic relevant image sourcing via Pixabay API |
| **Gantt Charts** | Automated project timeline generation |
| **Budget Tables** | Structured financial planning sections |
| **Bibliography Generation** | Automated reference list creation |
| **Speaker Notes** | Presentation coaching and notes |

---

## 📄 Document Types

### 1. Technical Report Generator

**Path:** `/generate/report`

Generates BET-standard technical reports suitable for engineering and scientific documentation.

**Features:**
- Structured sections: Abstract, Introduction, Literature Review, Methodology, Results, Discussion, Conclusion
- Automated Gantt chart generation for project timelines
- Budget table creation with cost breakdowns
- LaTeX equation support with KaTeX rendering
- IEEE and Harvard citation styles
- Figure and table numbering with proper captions

**Export Formats:** DOCX, PDF, HTML

---

### 2. PowerPoint Presentation Generator

**Path:** `/generate/powerpoint`

Creates professional slide decks with comprehensive speaker support.

**Features:**
- Professional slide layouts with consistent formatting
- Automatic speaker notes generation
- Visual element suggestions and prompts
- TTS (Text-to-Speech) coaching support
- Slide timing recommendations
- Key points highlighting

**Export Formats:** PPTX, PDF, HTML

---

### 3. Conference Paper Generator

**Path:** `/generate/conference`

Produces IEEE-formatted two-column academic papers ready for conference submission.

**Features:**
- Two-column layout matching IEEE standards
- Proper academic structure (Abstract, Keywords, Introduction, Related Work, Methodology, Results, Conclusion)
- IEEE citation format with numbered references
- Figure and table placement guidelines
- Word count optimization
- Camera-ready formatting

**Export Formats:** DOCX, PDF, HTML

---

### 4. Thesis/Dissertation Generator

**Path:** `/generate/thesis`

Generates complete thesis documents with all required components.

**Features:**
- Complete front matter (Title Page, Abstract, Acknowledgments, Table of Contents, List of Figures, List of Tables)
- Chapter-based structure
- Harvard citation style
- Bibliography/References section
- Appendices support
- Page numbering (Roman numerals for front matter, Arabic for body)
- Header/footer configuration

**Export Formats:** DOCX, PDF, HTML

---

### 5. Custom Report Generator

**Path:** `/generate/custom-report`

Flexible report generation with customizable sections and formatting.

**Features:**
- User-defined section structure
- Multiple citation style options
- Flexible formatting preferences
- Template customization
- Brand/logo integration options

**Export Formats:** DOCX, PDF, HTML

---

### 6. AI Image Generator

**Path:** `/generate/images`

Create custom images from text descriptions for use in documents.

**Features:**
- Text-to-image generation via Pollinations.ai
- Multiple aspect ratios (Square, Landscape, Portrait)
- Style presets (Realistic, Artistic, Diagram, etc.)
- Batch generation support
- Direct download in multiple formats

**Export Formats:** PNG, JPEG, WEBP

---

### 7. Reference Library

**Path:** `/references`

Comprehensive citation management system.

**Features:**
- Smart import from URLs (auto-extracts metadata)
- DOI lookup and import
- BibTeX file import
- Manual entry with guided forms
- Multiple citation style output (APA, MLA, Chicago, Harvard, IEEE)
- Export to BibTeX, RIS, CSV formats
- Search and filter capabilities
- Tag-based organization

**Export Formats:** BibTeX, RIS, CSV

---

## 🛠️ Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.x | UI component library with hooks |
| **TypeScript** | 5.x | Type-safe JavaScript development |
| **Vite** | 5.x | Fast build tool and dev server |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **Shadcn/UI** | Latest | Accessible component library (Radix UI primitives) |
| **Wouter** | 3.x | Lightweight client-side routing (~1.5KB) |
| **TanStack Query** | 5.x | Server state management and caching |
| **Framer Motion** | 11.x | Animation library |
| **Lucide React** | Latest | Icon library |
| **React Icons** | Latest | Additional icon sets |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime |
| **Express.js** | 4.x | Web application framework |
| **TypeScript** | 5.x | Type-safe backend development |
| **Drizzle ORM** | Latest | TypeScript-first ORM |
| **PostgreSQL** | 15+ | Relational database (via Neon serverless) |
| **tsx** | Latest | TypeScript execution for development |

### AI & External APIs

| Service | Purpose |
|---------|---------|
| **Google Gemini 2.5 Flash** | Primary AI model for content generation |
| **Pixabay API** | Stock image search and integration |
| **Pollinations.ai** | AI image generation (free tier) |

### Authentication & Storage

| Service | Purpose |
|---------|---------|
| **Firebase Authentication** | User authentication (Google Sign-In) |
| **Firebase Firestore** | NoSQL cloud database for project storage |
| **LocalStorage** | Client-side chat history persistence |

### Export & Document Libraries

| Library | Purpose |
|---------|---------|
| **docx** | Microsoft Word document generation |
| **PptxGenJS** | PowerPoint presentation generation |
| **file-saver** | Client-side file downloads |
| **html2canvas** | HTML to image conversion |
| **KaTeX** | LaTeX mathematical equation rendering |

### Development & Build Tools

| Tool | Purpose |
|------|---------|
| **Vite** | Development server and production builds |
| **ESBuild** | Fast JavaScript/TypeScript bundling |
| **PostCSS** | CSS processing |
| **Autoprefixer** | CSS vendor prefixing |
| **dotenv** | Environment variable management |

### Deployment & Hosting

| Service | Purpose |
|---------|---------|
| **Railway** | Cloud hosting platform |
| **Neon** | Serverless PostgreSQL database |
| **Firebase** | Authentication and Firestore hosting |

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Pages     │  │ Components  │  │        Hooks            │ │
│  │  - Home     │  │ - Sidebar   │  │ - useDocumentGenerator  │ │
│  │  - Generate │  │ - Chatbot   │  │ - useFileUpload         │ │
│  │  - Projects │  │ - Layout    │  │ - useRandomTopic        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                           │                                     │
│                    TanStack Query                               │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Express.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Routes    │  │   Services  │  │       Middleware        │ │
│  │ - /api/gen  │  │ - Gemini AI │  │ - Auth validation       │ │
│  │ - /api/chat │  │ - Pixabay   │  │ - Rate limiting         │ │
│  │ - /api/img  │  │ - Firebase  │  │ - Error handling        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  Google       │  │   Firebase    │  │   PostgreSQL  │
│  Gemini AI    │  │  Auth/Store   │  │   (Neon)      │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Data Flow

1. **User Input** → User enters topic/uploads files on frontend
2. **API Request** → Frontend sends request to Express backend
3. **AI Processing** → Backend calls Gemini AI with structured prompts
4. **Streaming Response** → AI response streams back to frontend
5. **Document Rendering** → Frontend renders document in real-time
6. **Export** → User exports to desired format (DOCX/PDF/PPTX/HTML)
7. **Cloud Save** → Optional save to Firebase Firestore

---

## 📁 Project Structure

```
AcademicGen/
├── client/                          # Frontend React application
│   ├── public/                      # Static assets
│   │   ├── favicon.ico              # Browser favicon
│   │   ├── favicon.svg              # SVG favicon
│   │   ├── favicon-16x16.png        # Small favicon
│   │   ├── favicon-32x32.png        # Medium favicon
│   │   ├── apple-touch-icon.png     # iOS home screen icon
│   │   └── og-image.png             # Open Graph social image
│   │
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── ui/                  # Shadcn/UI components
│   │   │   │   ├── accordion.tsx
│   │   │   │   ├── alert.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── scroll-area.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── slider.tsx
│   │   │   │   ├── switch.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── textarea.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   ├── toaster.tsx
│   │   │   │   └── tooltip.tsx
│   │   │   │
│   │   │   ├── app-sidebar.tsx      # Main navigation sidebar
│   │   │   ├── auth-provider.tsx    # Firebase auth context
│   │   │   ├── chatbot-widget.tsx   # Floating AI chatbot
│   │   │   ├── chatbot-dialog.tsx   # Chatbot dialog variant
│   │   │   ├── generator-layout.tsx # Document generator layout
│   │   │   ├── theme-provider.tsx   # Dark/light theme context
│   │   │   ├── theme-toggle.tsx     # Theme switch button
│   │   │   └── usage-banner.tsx     # Usage limit display
│   │   │
│   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── use-document-generator.ts  # Document generation logic
│   │   │   ├── use-file-upload.ts         # File upload handling
│   │   │   ├── use-mobile.ts              # Mobile detection
│   │   │   ├── use-random-topic.ts        # Random topic generation
│   │   │   ├── use-toast.ts               # Toast notifications
│   │   │   └── use-user.ts                # User authentication state
│   │   │
│   │   ├── lib/                     # Utility functions
│   │   │   ├── firebase.ts          # Firebase configuration
│   │   │   ├── queryClient.ts       # TanStack Query setup
│   │   │   └── utils.ts             # General utilities (cn, etc.)
│   │   │
│   │   ├── pages/                   # Application pages/routes
│   │   │   ├── home.tsx             # Landing page
│   │   │   ├── generate-report.tsx  # Technical report generator
│   │   │   ├── generate-powerpoint.tsx  # Presentation generator
│   │   │   ├── generate-conference.tsx  # Conference paper generator
│   │   │   ├── generate-thesis.tsx      # Thesis generator
│   │   │   ├── generate-custom-report.tsx # Custom report generator
│   │   │   ├── generate-images.tsx      # AI image generator
│   │   │   ├── my-projects.tsx      # Saved projects list
│   │   │   ├── templates.tsx        # Document templates
│   │   │   ├── references.tsx       # Reference library
│   │   │   ├── ai-assistant.tsx     # Full AI assistant page
│   │   │   ├── analytics.tsx        # Usage analytics
│   │   │   ├── about.tsx            # About page with privacy policy
│   │   │   ├── contact.tsx          # Contact form
│   │   │   ├── settings.tsx         # User settings
│   │   │   ├── pricing.tsx          # Membership pricing
│   │   │   ├── checkout-success.tsx # Payment success page
│   │   │   ├── checkout-cancel.tsx  # Payment cancelled page
│   │   │   └── not-found.tsx        # 404 page
│   │   │
│   │   ├── App.tsx                  # Main application component
│   │   ├── main.tsx                 # Application entry point
│   │   └── index.css                # Global styles
│   │
│   └── index.html                   # HTML template with meta tags
│
├── server/                          # Backend Express application
│   ├── lib/
│   │   └── gemini.ts                # Google Gemini AI integration
│   │
│   ├── index.ts                     # Server entry point (production)
│   ├── index-dev.ts                 # Server entry point (development)
│   ├── routes.ts                    # API route handlers
│   ├── storage.ts                   # Data storage interface
│   └── vite.ts                      # Vite middleware for dev
│
├── shared/                          # Shared types and schemas
│   └── schema.ts                    # Drizzle ORM schemas and types
│
├── .env                             # Environment variables (not in repo)
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── drizzle.config.ts                # Drizzle ORM configuration
├── package.json                     # Dependencies and scripts
├── postcss.config.js                # PostCSS configuration
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.json                    # TypeScript configuration
├── vite.config.ts                   # Vite build configuration
└── README.md                        # Project documentation
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** 9.0 or higher (or yarn/pnpm)
- **Git** for cloning the repository

### Step-by-Step Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/henockhnk092-dot/Academic-Document-Generator.git
cd Academic-Document-Generator
```

#### 2. Install Dependencies

```bash
npm install
```

This installs all frontend and backend dependencies defined in `package.json`.

#### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your credentials (see Configuration section below).

#### 4. Database Setup (Optional)

If using PostgreSQL for persistent storage:

```bash
# Push schema to database
npm run db:push

# Generate migrations (if needed)
npm run db:generate
```

#### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5000`.

#### 6. Build for Production

```bash
npm run build
```

#### 7. Start Production Server

```bash
npm start
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# ============================================
# REQUIRED VARIABLES
# ============================================

# Google Gemini AI API Key
# Get yours at: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Session Secret (any random string for session encryption)
SESSION_SECRET=your_random_session_secret_here

# ============================================
# OPTIONAL - Image Search
# ============================================

# Pixabay API Key (for stock image search)
# Get yours at: https://pixabay.com/api/docs/
PIXABAY_API_KEY=your_pixabay_api_key_here

# ============================================
# OPTIONAL - Firebase Authentication & Storage
# ============================================

# Firebase Configuration
# Get these from Firebase Console > Project Settings
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# ============================================
# OPTIONAL - Database
# ============================================

# PostgreSQL Connection String
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://user:password@host:5432/academicgen

# ============================================
# OPTIONAL - Payments (Buy Me a Coffee / Stripe)
# ============================================

# Buy Me a Coffee Webhook Secret
BMC_WEBHOOK_SECRET=your_bmc_webhook_secret

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# ============================================
# OPTIONAL - Analytics
# ============================================

# Google Analytics Measurement ID
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication > Google Sign-In
4. Enable Firestore Database
5. Copy configuration to `.env` file

### Obtaining API Keys

#### Google Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key to `GEMINI_API_KEY`

#### Pixabay API Key
1. Visit [Pixabay API Documentation](https://pixabay.com/api/docs/)
2. Create a free account
3. Find your API key in your account settings
4. Copy to `PIXABAY_API_KEY`

---

## 📡 API Documentation

### Base URL

- **Development:** `http://localhost:5000/api`
- **Production:** `https://academicgen.com/api`

### Document Generation Endpoints

#### Generate Technical Report
```http
POST /api/generate/report
Content-Type: application/json

{
  "topic": "string",
  "tone": "formal" | "academic" | "casual",
  "length": "short" | "medium" | "long",
  "citationStyle": "ieee" | "harvard",
  "includeGantt": boolean,
  "includeBudget": boolean,
  "additionalContext": "string"
}
```

#### Generate PowerPoint Presentation
```http
POST /api/generate/powerpoint
Content-Type: application/json

{
  "topic": "string",
  "slideCount": number,
  "includeNotes": boolean,
  "includeVisualPrompts": boolean,
  "style": "professional" | "academic" | "creative"
}
```

#### Generate Conference Paper
```http
POST /api/generate/conference
Content-Type: application/json

{
  "topic": "string",
  "abstract": "string",
  "keywords": ["string"],
  "wordCount": number,
  "citationStyle": "ieee"
}
```

#### Generate Thesis
```http
POST /api/generate/thesis
Content-Type: application/json

{
  "topic": "string",
  "degree": "masters" | "phd",
  "chapters": ["string"],
  "citationStyle": "harvard"
}
```

### AI Chatbot Endpoint

```http
POST /api/chat
Content-Type: application/json

{
  "message": "string"
}

Response:
{
  "response": "string"
}
```

### Image Search Endpoint

```http
POST /api/images/search
Content-Type: application/json

{
  "query": "string",
  "count": number
}

Response:
{
  "images": [
    {
      "url": "string",
      "thumbnail": "string",
      "width": number,
      "height": number
    }
  ]
}
```

### File Processing Endpoint

```http
POST /api/files/process
Content-Type: multipart/form-data

file: File (PDF, DOCX, TXT, or image)

Response:
{
  "text": "string",
  "metadata": {
    "filename": "string",
    "type": "string",
    "size": number
  }
}
```

### Response Formats

All API responses follow this structure:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Rate Limiting

- **Guest users:** 3 generations total
- **Authenticated users:** 5 generations total
- **Members:** Unlimited generations

---

## 🧩 Component Documentation

### Core Components

#### AppSidebar (`app-sidebar.tsx`)

Main navigation sidebar with collapsible menu items.

**Features:**
- Responsive collapse on mobile
- Active route highlighting
- Icon + label navigation items
- User authentication status display

**Usage:**
```tsx
import { AppSidebar } from "@/components/app-sidebar";

<SidebarProvider>
  <AppSidebar />
  {/* Main content */}
</SidebarProvider>
```

---

#### ChatbotWidget (`chatbot-widget.tsx`)

Floating AI chatbot assistant with full-screen mobile support.

**Features:**
- Floating button in bottom-right corner
- Full-screen on mobile devices
- Message history persistence (LocalStorage)
- Copy and TTS (Text-to-Speech) for responses
- Markdown rendering for AI responses
- Navigation links in responses

**Props:** None (self-contained)

**Usage:**
```tsx
import { ChatbotWidget } from "@/components/chatbot-widget";

<ChatbotWidget />
```

---

#### GeneratorLayout (`generator-layout.tsx`)

Shared layout for all document generators.

**Features:**
- Split-panel layout (config left, preview right)
- Responsive stacking on mobile
- Export dropdown menu
- Save to cloud functionality
- Loading states

**Props:**
```typescript
interface GeneratorLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  preview: React.ReactNode;
  onExport: (format: string) => void;
  onSave: () => void;
  isGenerating: boolean;
}
```

---

#### ThemeProvider (`theme-provider.tsx`)

Dark/light theme context provider.

**Features:**
- System preference detection
- Manual toggle override
- Persistence in LocalStorage
- CSS variable switching

**Usage:**
```tsx
import { ThemeProvider } from "@/components/theme-provider";

<ThemeProvider>
  <App />
</ThemeProvider>
```

---

#### AuthProvider (`auth-provider.tsx`)

Firebase authentication context provider.

**Features:**
- Google Sign-In integration
- User state management
- Auth persistence
- Sign out functionality

**Exposed Context:**
```typescript
interface AuthContext {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

---

## 🪝 Hooks Documentation

### useDocumentGenerator

Core hook for document generation functionality.

**Returns:**
```typescript
{
  content: string;
  isGenerating: boolean;
  error: Error | null;
  generate: (params: GenerateParams) => Promise<void>;
  reset: () => void;
}
```

**Usage:**
```tsx
const { content, isGenerating, generate } = useDocumentGenerator();

const handleGenerate = async () => {
  await generate({
    type: 'report',
    topic: 'AI in Healthcare',
    tone: 'academic'
  });
};
```

---

### useFileUpload

File upload and processing hook.

**Returns:**
```typescript
{
  files: File[];
  uploading: boolean;
  error: Error | null;
  upload: (files: FileList) => Promise<string>;
  clear: () => void;
}
```

**Supported Formats:** PDF, DOCX, TXT, PNG, JPG, JPEG

---

### useRandomTopic

Generate random academic topics for inspiration.

**Returns:**
```typescript
{
  topic: string;
  loading: boolean;
  generate: () => void;
}
```

---

### useToast

Toast notification system.

**Returns:**
```typescript
{
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}
```

**Usage:**
```tsx
const { toast } = useToast();

toast({
  title: "Success",
  description: "Document generated successfully",
  variant: "default" // or "destructive"
});
```

---

### useUser

User authentication state hook.

**Returns:**
```typescript
{
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  generationsLeft: number;
}
```

---

## 🗄️ Database Schema

### Users Table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebase_uid VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  photo_url TEXT,
  generation_count INTEGER DEFAULT 0,
  membership_type VARCHAR(50) DEFAULT 'free',
  membership_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Projects Table

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content TEXT,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### References Table

```sql
CREATE TABLE references (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  authors TEXT[],
  year INTEGER,
  source VARCHAR(255),
  url TEXT,
  doi VARCHAR(255),
  citation_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Authentication

### Firebase Authentication Setup

1. **Enable Google Sign-In:**
   - Firebase Console > Authentication > Sign-in method
   - Enable Google provider
   - Add authorized domains

2. **Security Rules (Firestore):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /projects/{projectId} {
      allow read, write: if request.auth != null &&
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### Authentication Flow

1. User clicks "Sign in with Google"
2. Firebase popup opens for Google authentication
3. On success, Firebase returns user credentials
4. Frontend stores user in AuthContext
5. Backend validates Firebase ID token on protected routes

---

## 🚢 Deployment

### Railway Deployment

1. **Connect Repository:**
   - Link GitHub repository to Railway
   - Configure environment variables

2. **Build Settings:**
   ```
   Build Command: npm run build
   Start Command: npm start
   ```

3. **Environment Variables:**
   - Add all `.env` variables in Railway dashboard

4. **Custom Domain:**
   - Add domain in Railway settings
   - Update DNS records

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

---

## 📖 Usage Guide

### Generating a Technical Report

1. Navigate to "Technical Report" from sidebar or home page
2. Enter your topic (e.g., "Machine Learning in Medical Diagnosis")
3. Configure options:
   - **Tone:** Formal/Academic/Casual
   - **Length:** Short/Medium/Long
   - **Citation Style:** IEEE/Harvard
   - **Include Gantt Chart:** Yes/No
   - **Include Budget Table:** Yes/No
4. Optionally upload reference files (PDF/DOCX)
5. Click "Generate Report"
6. Watch real-time preview as content generates
7. Export to DOCX, PDF, or HTML
8. Optionally save to cloud (requires sign-in)

### Using the AI Chatbot

1. Click the floating bot icon (bottom-right)
2. Type your question about the platform
3. AI responds with helpful information
4. Click links in responses to navigate
5. Use copy/TTS buttons for AI responses
6. Clear chat with trash icon

### Managing References

1. Navigate to "References" page
2. Import references:
   - **URL Import:** Paste article URL
   - **DOI Import:** Enter DOI number
   - **BibTeX Import:** Upload .bib file
   - **Manual Entry:** Fill form fields
3. Edit/delete references as needed
4. Export in desired format (BibTeX/RIS/CSV)
5. Copy formatted citations (APA/MLA/Chicago/Harvard/IEEE)

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### Getting Started

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Academic-Document-Generator.git
   ```
3. **Create a feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make your changes**
5. **Commit with descriptive message:**
   ```bash
   git commit -m 'Add amazing feature: description'
   ```
6. **Push to your fork:**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing code formatting
- Add comments for complex logic
- Write descriptive commit messages
- Test your changes before submitting

### Reporting Issues

- Use GitHub Issues for bug reports
- Include steps to reproduce
- Provide browser/OS information
- Attach screenshots if relevant

---

## 👨‍💻 Author

**HNK** - Computer Engineer | Cape Town, South Africa

Passionate about building tools that make academic and professional life easier. With expertise spanning software development, scientific computing, network infrastructure, electronics, and embedded systems.

### Connect with Me

| Platform | Link |
|----------|------|
| **GitHub** | [@henockhnk092-dot](https://github.com/henockhnk092-dot) |
| **Twitter/X** | [@HnkHorizon](https://twitter.com/HnkHorizon) |
| **YouTube** | [@HNK2005](https://youtube.com/@HNK2005) |
| **TikTok** | [@codingfever](https://tiktok.com/@codingfever) |
| **Instagram** | [@hhnk.3693](https://instagram.com/hhnk.3693) |
| **Discord** | hnk0422_76455 |
| **Email** | hhnk3693@gmail.com |

---

## 📄 License

This project is open source and available under the **MIT License**.

```
MIT License

Copyright (c) 2024 HNK

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

Special thanks to the following projects and services that make AcademicGen possible:

| Project | Contribution |
|---------|--------------|
| [Google Gemini](https://ai.google.dev/) | AI content generation engine |
| [React](https://react.dev/) | UI component library |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| [Shadcn/UI](https://ui.shadcn.com/) | Beautiful, accessible components |
| [Radix UI](https://www.radix-ui.com/) | Unstyled, accessible primitives |
| [Pixabay](https://pixabay.com/) | Free stock images |
| [Pollinations.ai](https://pollinations.ai/) | Free AI image generation |
| [Firebase](https://firebase.google.com/) | Authentication and cloud storage |
| [Railway](https://railway.app/) | Cloud hosting platform |
| [Neon](https://neon.tech/) | Serverless PostgreSQL |
| [Lucide Icons](https://lucide.dev/) | Beautiful icon library |
| [KaTeX](https://katex.org/) | LaTeX math rendering |

---

## 🌟 Support the Project

If you find AcademicGen useful, please consider:

- ⭐ **Starring** this repository
- 🐛 **Reporting** bugs and issues
- 💡 **Suggesting** new features
- 🤝 **Contributing** code or documentation
- ☕ **Buying me a coffee** at [buymeacoffee.com/hnk](https://buymeacoffee.com/hnk)

---

<p align="center">
  <strong>Built with ❤️ for students and researchers worldwide</strong>
  <br><br>
  <a href="https://academicgen.com">
    <img src="https://img.shields.io/badge/🚀_Try_AcademicGen_Now-Visit_Site-blue?style=for-the-badge" alt="Visit Site">
  </a>
</p>

---

<p align="center">
  <sub>Powered by Google Gemini AI | Made in Cape Town, South Africa 🇿🇦</sub>
</p>
