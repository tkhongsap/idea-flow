# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IdeaFlow** is a personal AI-powered idea organizer that helps users capture spontaneous thoughts (via text or voice) and automatically organizes them into structured, actionable themes. It's a React-based web application deployed as a Google AI Studio app.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **AI:** Google Gemini API (`gemini-2.5-flash` model)
- **Styling:** Tailwind CSS 3 (CDN-based)
- **Storage:** Browser localStorage (no backend)
- **Audio:** Web Audio API, MediaRecorder API

## Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server at http://localhost:3000
npm run build            # Production build to dist/
npm run preview          # Preview production build
```

**Environment Setup:**
- Set `GEMINI_API_KEY` in `.env.local` file (required for all AI features)
- The Vite config automatically injects this as `process.env.API_KEY`

## High-Level Architecture

### State Management
All application state is centralized in `App.tsx` using React hooks:
- `rawIdeas[]` - Unprocessed user input (text/voice)
- `themes[]` - AI-organized themes with atoms, actions, questions
- Auto-saves to localStorage on every change
- **2-second debounce** before triggering AI organization to batch process ideas efficiently

### Data Flow Pipeline
```
User Input (voice/text) → RawIdea → [2s debounce] → Gemini organizeIdeas() → Theme[]
```

### Component Hierarchy
- `App.tsx` - Root state manager, handles all business logic, routing, and drag-and-drop
- `CaptureInput.tsx` - Dual text/voice input with recording and waveform visualization
- `IdeasList.tsx` - Raw idea display with delete and chat actions
- `ThemeList.tsx` - Grid of organized themes with drag-and-drop reordering
- `ThemeDetail.tsx` - Full theme view with markdown-formatted atoms/actions/questions
- `ConversationView.tsx` - AI chat interface for brainstorming about themes
- `services/geminiService.ts` - All Gemini API integration

### AI Integration (geminiService.ts)

The Gemini API is used for four critical functions:

1. **`organizeIdeas(rawIdeas)`** - Core intelligence that transforms raw text into structured themes with:
   - Title (3-6 words)
   - Summary paragraph
   - 3-5 conceptual tags
   - Idea atoms (broken-down thoughts)
   - Action items (concrete next steps)
   - Open-ended questions

2. **`chatWithTheme(theme, history, message)`** - Creative brainstorming assistant for exploring themes

3. **`transcribeAudio(audioBase64, mimeType)`** - Voice-to-text conversion for voice input

4. **`semanticSearch(query, ideas, themes)`** - Concept-based search (not keyword matching)

### Key Features & Patterns

**Two-View System:**
- "Ideas" view = raw capture mode
- "Themes" view = organized output mode

**Voice Input Pipeline:**
```
Record audio → Base64 encode → Gemini transcription → Process as text idea
```

**Drag-and-Drop:**
- Reorder ideas/themes within their lists
- Drag raw ideas into specific themes to associate them
- Implementation uses React state updates with array manipulation

**Search:** Keyboard shortcut `Cmd+K` triggers semantic search that finds contextually relevant ideas/themes (not just keyword matches)

## Data Models (types.ts)

```typescript
RawIdea {
  id, content, timestamp, sourceType: 'text' | 'voice', tags?
}

Theme {
  id, title, summary, tags, ideaAtoms, actionItems, questions, isUserCreated?
}

IdeaAtom {
  id, content, sourceIdeaId  // Links back to original RawIdea
}

ChatMessage {
  role: 'user' | 'model', content
}
```

## Build Configuration

**vite.config.ts:**
- Dev server runs on port 3000, host 0.0.0.0
- Path alias: `@/*` maps to root directory
- Environment variable: `GEMINI_API_KEY` → `process.env.API_KEY`

**index.html:**
- Uses import maps to load React and Gemini SDK from CDN (aistudiocdn.com)
- Tailwind CSS loaded via CDN with custom theme (cream/sage/stone colors)
- Supports dark mode

**tsconfig.json:**
- Target: ES2022, Module: bundler
- JSX: react-jsx (automatic)
- Path aliases configured for `@/*`

## Important Notes

- **Privacy-first:** All data stored in browser localStorage, no backend/server
- **AI-first design:** All organization/analysis delegated to Gemini, minimal local logic
- **Debounced processing:** Wait 2 seconds after last idea input before calling AI to batch process efficiently
- **Google AI Studio deployment:** The app is designed to be deployed through Google AI Studio with microphone permissions

## Project Context

- Deployed via Google AI Studio: https://ai.studio/apps/drive/1mQyB_Z4JPUDdMI0CDJN1uoDAJWb-tI_L
- Recent features: markdown formatting in ThemeDetail, AI suggestion chips, audio waveform visualization
- Version: 0.0.0 (early stage, active development)
