# IdeaFlow - Personal Brain Dump & Organizer

## Overview
IdeaFlow is a React-based web application that helps you capture and organize your thoughts using Google's Gemini AI. The app allows you to quickly jot down ideas (via text or voice) and automatically organizes them into meaningful themes with action items and questions.

## Project Architecture

### Tech Stack
- **Frontend Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 6.2.0
- **AI Service**: Google Gemini 2.5 Flash (via @google/genai)
- **Styling**: Tailwind CSS (CDN)
- **Storage**: Browser LocalStorage

### Directory Structure
```
.
├── components/          # React components
│   ├── icons/          # SVG icon components
│   ├── CaptureInput.tsx    # Text/voice input component
│   ├── ConversationView.tsx # Chat interface with themes
│   ├── CreateThemeModal.tsx # Modal for creating themes
│   ├── IdeaCard.tsx        # Individual idea display
│   ├── IdeasList.tsx       # List of all ideas
│   ├── ThemeDetail.tsx     # Theme detail view
│   ├── ThemeList.tsx       # List of themes
│   └── Waveform.tsx        # Audio waveform visualization
├── services/
│   └── geminiService.ts    # Gemini AI integration
├── utils/
│   └── time.ts            # Time utilities
├── App.tsx                # Main app component
├── types.ts               # TypeScript type definitions
└── index.tsx              # App entry point
```

### Key Features
1. **Idea Capture**: Quick text or voice input for capturing thoughts
2. **AI Organization**: Automatic theme extraction and idea clustering using Gemini AI
3. **Semantic Search**: AI-powered search across ideas and themes
4. **Theme Chat**: Interactive conversations about specific themes
5. **Drag & Drop**: Reorganize ideas and themes manually
6. **Dark Mode**: Support for light and dark themes

## Setup & Configuration

### Environment Variables
- `GEMINI_API_KEY`: Required - Google Gemini API key for AI features

### Development
- **Port**: 5000
- **Host**: 0.0.0.0 (allows Replit proxy access)
- **Workflow**: `npm run dev`

### Deployment
- **Type**: Autoscale (stateless web app)
- **Build**: `npm run build`
- **Run**: `npx vite preview --host 0.0.0.0 --port 5000`

## Recent Changes

### November 7, 2025 - Security Architecture Update
- **Fixed critical security vulnerability**: API key no longer exposed in frontend bundle
- Implemented secure backend proxy architecture:
  - Created Express.js backend API (`backend/` folder)
  - Backend proxies all Gemini API calls securely
  - API key stored only in backend Replit Secrets (never sent to browser)
  - Strict CORS policy: only specific frontend URL can access API
  - Rate limiting: 100 requests per 15 minutes per IP
  - Request validation on all endpoints
- Deployment architecture: Two Replit apps (one Git repo)
  - Frontend app: React + Vite on port 5000
  - Backend app: Express API on port 3000 (separate Replit deployment)
  - Backend URL configured via `VITE_BACKEND_API_URL` secret
- Updated frontend services to call backend API instead of direct Gemini calls
- Created comprehensive deployment documentation:
  - `DEPLOYMENT_GUIDE.md` - Step-by-step setup instructions
  - `POST_DEPLOYMENT_CHECKLIST.md` - Testing verification
  - `BACKEND_SETUP.md` - Technical reference
  - `API_SECURITY_FIX_SUMMARY.md` - Overview of changes

### November 6, 2025 - Initial Setup
- Configured Vite to run on port 5000 for Replit compatibility
- Added `allowedHosts: true` to Vite config for proxy support
- Configured workflow and deployment settings

## Data Storage
The app uses browser LocalStorage to persist:
- Raw ideas (`ideaflow_rawIdeas`)
- Organized themes (`ideaflow_themes`)

Note: Data is stored locally in the browser and not synced to any server.

## AI Integration
The app uses Gemini 2.5 Flash for:
- **Idea Organization**: Breaking down raw ideas into atomic thoughts and clustering them into themes
- **Theme Enrichment**: Generating summaries, tags, action items, and questions
- **Semantic Search**: Finding relevant ideas and themes based on meaning
- **Chat**: Interactive brainstorming within theme contexts
- **Audio Transcription**: Converting voice recordings to text

## Known Considerations
- Tailwind CSS is loaded via CDN (index.html) - suitable for this use case but note the console warning
- All AI processing happens client-side using the Gemini API
- No user authentication or multi-user support
- Data persists only in browser LocalStorage
