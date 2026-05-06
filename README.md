# PaperGen AI - Academic Document Generator

> A unified AI-powered platform for generating professional academic documents using Google Gemini 2.5 Flash

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-blue)](https://academicgen.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black)](https://github.com/henockhnk092-dot/Academic-Document-Generator)

---

## Overview

**PaperGen AI** is a comprehensive web application that leverages artificial intelligence to generate professional academic documents. The platform supports four distinct document types, each with specialized formatting, citation styles, and export options.

### Live Demo
**[https://academicgen.com](https://academicgen.com)**

---

## Features

### Document Generators

| Generator | Description | Citation Style | Export Formats |
|-----------|-------------|----------------|----------------|
| **Technical Report** | BET-standard reports with Gantt charts, budget tables, and LaTeX equations | IEEE/Harvard | HTML, Word (.docx), PDF |
| **PowerPoint Presentation** | Professional slides with speaker notes, visual prompts, and TTS coaching | - | HTML, PowerPoint (.pptx), PDF |
| **Conference Paper** | Two-column academic papers with proper structure and references | IEEE | HTML, Word (.docx), PDF |
| **Thesis/Dissertation** | Complete thesis with front matter, chapters, and bibliography | Harvard | HTML, Word (.docx), PDF |

### Platform Capabilities

- **AI-Powered Content Generation** - Powered by Google Gemini 2.5 Flash for intelligent document creation
- **Image Integration** - Automatic image sourcing via Pixabay API
- **File Upload Support** - Upload PDF, DOCX, TXT files or images to extract content
- **Cloud Storage** - Save projects to Firebase Firestore
- **Firebase Authentication** - Secure user authentication with Google Sign-In
- **AI Chatbot Assistant** - Built-in chatbot to guide users through the platform
- **Real-time Preview** - Live document preview as content is generated
- **Fully Responsive** - Works on all devices from mobile (320px) to ultra-wide monitors
- **Project Management** - Organize and manage all generated documents

---

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Shadcn/UI** - Component library with Radix UI primitives
- **Wouter** - Lightweight client-side routing
- **TanStack Query** - Server state management
- **Framer Motion** - Animations

### Backend
- **Express.js** - Node.js web framework
- **TypeScript** - Type-safe JavaScript
- **Drizzle ORM** - TypeScript ORM for database operations

### AI & APIs
- **Google Gemini 2.5 Flash** - AI content generation
- **Pixabay API** - Stock image integration
- **KaTeX** - LaTeX mathematical rendering

### Authentication & Storage
- **Firebase Authentication** - User authentication
- **Firebase Firestore** - Cloud database storage
- **PostgreSQL** - Database (via Neon serverless)

### Export Libraries
- **docx** - Microsoft Word document generation
- **PptxGenJS** - PowerPoint presentation generation
- **file-saver** - Client-side file downloads

---

## Project Structure

```
├── client/                    # Frontend React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── ui/            # Shadcn UI components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── chatbot-widget.tsx
│   │   │   ├── chatbot-dialog.tsx
│   │   │   └── generator-layout.tsx
│   │   ├── pages/             # Application pages
│   │   │   ├── home.tsx
│   │   │   ├── generate-report.tsx
│   │   │   ├── generate-powerpoint.tsx
│   │   │   ├── generate-conference.tsx
│   │   │   ├── generate-thesis.tsx
│   │   │   ├── projects.tsx
│   │   │   ├── about.tsx
│   │   │   ├── contact.tsx
│   │   │   └── settings.tsx
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── use-document-generator.ts
│   │   │   ├── use-file-upload.ts
│   │   │   └── use-random-topic.ts
│   │   ├── lib/               # Utility functions
│   │   │   ├── firebase.ts
│   │   │   └── queryClient.ts
│   │   └── App.tsx            # Main application component
│   └── index.html
├── server/                    # Backend Express application
│   ├── lib/
│   │   └── gemini.ts          # Gemini AI integration
│   ├── routes.ts              # API route handlers
│   ├── storage.ts             # Data storage interface
│   └── index.ts               # Server entry point
├── shared/                    # Shared types and schemas
│   └── schema.ts              # Drizzle schemas and types
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── tsconfig.json
```

---

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (optional, for persistent storage)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/henockhnk092-dot/Academic-Document-Generator.git
   cd Academic-Document-Generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # AI Services
   GEMINI_API_KEY=your_gemini_api_key
   PIXABAY_API_KEY=your_pixabay_api_key
   
   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
   VITE_FIREBASE_APP_ID=your_firebase_app_id
   
   # Database (optional)
   DATABASE_URL=your_postgresql_connection_string
   
   # Session
   SESSION_SECRET=your_session_secret
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5000
   ```

---

## API Endpoints

### Document Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/generate/report` | Generate technical report |
| POST | `/api/generate/powerpoint` | Generate PowerPoint presentation |
| POST | `/api/generate/conference` | Generate conference paper |
| POST | `/api/generate/thesis` | Generate thesis document |

### File Processing

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/process` | Extract text from uploaded files |

### Image Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/images/search` | Search Pixabay for images |
| POST | `/api/images/random` | Get random topic-relevant image |

### AI Chatbot

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chatbot` | Send message to AI chatbot |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI generation |
| `PIXABAY_API_KEY` | No | Pixabay API key for image search |
| `VITE_FIREBASE_API_KEY` | No | Firebase API key for authentication |
| `VITE_FIREBASE_PROJECT_ID` | No | Firebase project ID |
| `VITE_FIREBASE_APP_ID` | No | Firebase app ID |
| `DATABASE_URL` | No | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret for session management |

---

## Usage

### Generating Documents

1. Navigate to the desired document type from the sidebar or home page
2. Enter your topic or upload reference files (PDF, DOCX, TXT, images)
3. Configure generation settings (tone, length, citation style, etc.)
4. Click "Generate" and watch the real-time preview
5. Export to your preferred format (HTML, Word, PowerPoint, PDF)
6. Save to cloud for future access

### AI Chatbot

Click the floating chatbot icon in the bottom-right corner to get help navigating the platform or understanding features.

---

## Screenshots

### Home Page
The landing page showcases all four document generators with quick access buttons.

### Document Generator
Each generator features a split-panel layout with configuration options on the left and live preview on the right.

### Export Options
Dropdown menus provide format-specific export options for each document type.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Author

**HNK** - Computer Engineer based in Cape Town, South Africa

With a versatile skill set spanning software development, scientific computing, network infrastructure, electronics and embedded systems.

### Connect

| Platform | Link |
|----------|------|
| GitHub | [@henockhnk092-dot](https://github.com/henockhnk092-dot) |
| Twitter/X | [@HnkHorizon](https://twitter.com/HnkHorizon) |
| YouTube | [@HNK2005](https://youtube.com/@HNK2005) |
| TikTok | [@codingfever](https://tiktok.com/@codingfever) |
| Instagram | [@hhnk.3693](https://instagram.com/hhnk.3693) |
| Discord | hnk0422_76455 |
| Email | hhnk3693@gmail.com |

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## Acknowledgments

- [Google Gemini](https://ai.google.dev/) - AI content generation
- [Pixabay](https://pixabay.com/) - Free stock images
- [Shadcn/UI](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Firebase](https://firebase.google.com/) - Authentication and cloud storage

---

<p align="center">
  <strong>Powered by Google Gemini AI</strong>
  <br>
  Made with passion for helping students and researchers create professional academic documents efficiently.
</p>
