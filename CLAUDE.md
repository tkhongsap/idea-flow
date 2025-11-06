# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IdeaFlow is a client-side AI-powered web application for capturing, organizing, and exploring ideas. It uses React + TypeScript + Vite on the frontend and integrates with Google Gemini 2.5 Flash for AI-powered organization, search, and chat features.

**Key characteristics:**
- No backend server - all data stored in browser LocalStorage
- Dual input modes: text and voice recording with AI transcription
- AI automatically organizes raw ideas into semantic themes with "idea atoms"
- Drag-and-drop reordering and theme assignment
- Deployed on Replit with autoscale configuration

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 5000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

**Environment Setup:**
Create `.env.local` with your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
```

Note: The build will fail if GEMINI_API_KEY is not set (injected via vite.config.ts).

## Architecture Overview

### Core State Management (App.tsx)

The main App component manages all application state without external state libraries:

- `rawIdeas[]` - Captured ideas from text/voice input
- `themes[]` - AI-organized themes with clustered idea atoms
- `selectedTheme` - Currently viewed theme for detail/chat
- `searchResults` - Filtered results from semantic search

State persists automatically to LocalStorage on every change.

**Key flow:** User captures idea → Auto-organization triggered (2s debounce) → Gemini analyzes and clusters into themes → UI updates with organized themes

### AI Service Integration (services/geminiService.ts)

All Gemini interactions use structured output with JSON schemas. Four main functions:

1. **organizeIdeas()** - Deep analysis of raw ideas:
   - Breaks ideas into atomic thoughts ("idea atoms")
   - Clusters atoms into semantic themes
   - Generates title, summary, tags, action items, questions
   - Each idea atom links back to source RawIdea

2. **semanticSearch()** - Conceptual search (not keyword matching):
   - Returns top 5 matching ideas and themes by ID
   - Searches both content and metadata

3. **chatWithTheme()** - Contextual brainstorming:
   - AI acts as "creative partner" with theme context
   - Maintains conversation history
   - Returns formatted markdown responses

4. **transcribeAudio()** - Audio to text conversion:
   - Used for voice capture and voice chat
   - Sends base64 audio with mime type

### Data Models (types.ts)

**RawIdea**: User's captured thought with id, content, timestamp, sourceType ('text' | 'voice'), and optional tags added during organization.

**Theme**: AI-organized cluster with title, summary, tags, ideaAtoms[], actionItems[], questions[], and isUserCreated flag.

**IdeaAtom**: Atomic distilled thought with id, content, and sourceIdeaId linking to original RawIdea.

### Component Architecture

**Input Layer:**
- `CaptureInput` - Handles text/voice input with waveform visualization
  - Cmd+Enter to submit
  - MediaRecorder API for voice with real-time transcription

**Display Layer:**
- `IdeasList` - Shows unorganized ideas with drag-reorder
- `ThemeList` - Grid of theme cards with create button
- `ThemeDetail` - Full theme view with atoms, chat, and manual idea addition
- `IdeaCard` - Individual idea display with tags and actions

**Interaction Layer:**
- `ConversationView` - Live audio chat with Gemini (separate from main flow)
- `ChatInterface` - Text-based theme brainstorming
- `CreateThemeModal` - Simple theme creation form

### Drag-and-Drop System

Three supported operations:
1. Reorder ideas within IdeasList
2. Reorder themes within ThemeList
3. Drag ideas from IdeasList into theme cards (auto-creates idea atom)

Implementation uses HTML5 Drag API with JSON payload serialization. The `draggedItem` state tracks current drag, and theme cards show visual feedback on drag-over.

## Important Technical Details

### Gemini API Usage

The application makes several types of Gemini calls:
- **Organization calls** are expensive (analyze all raw ideas) - debounced by 2 seconds
- **Search calls** process both ideas and themes
- **Chat calls** include full theme context and conversation history
- **Transcription calls** process audio in base64 format

All calls use structured output with defineSchema() to ensure consistent JSON responses.

### Voice Recording

Voice capture in CaptureInput uses browser MediaRecorder API:
- Attempts formats in order: webm/opus, ogg/opus, webm, ogg
- Uses AudioContext for real-time waveform visualization
- Converts to base64 for Gemini transcription
- Falls back gracefully if microphone unavailable

### LocalStorage Persistence

Data structure in localStorage:
```javascript
{
  "rawIdeas": RawIdea[],
  "themes": Theme[]
}
```

Auto-saves on every state change. No sync/backup mechanism. Cleared when browser data cleared.

### Search Implementation

Search uses Cmd+K keyboard shortcut and has two modes:
1. When typing: Shows live search box
2. When results returned: Shows filtered view of ideas and themes

The search is semantic via Gemini - understands concepts, not just keywords. Limited to top 5 results for performance.

## Styling and UI

- **Framework**: Tailwind CSS loaded via CDN (see index.html)
- **Theme**: Custom colors (sage green #A3B18A, cream #F8F5F2, stone palette)
- **Dark Mode**: Full support via Tailwind dark: classes
- **Typography**: Inter font family from Google Fonts
- **Layout**: Max-width 4xl container, responsive grid (1/2/3 columns)

Custom Tailwind extensions in index.html include pulse-fast animation.

## Testing

**Current state:** No tests exist. No testing framework installed.

If adding tests, consider:
- Vitest for unit tests (native Vite integration)
- React Testing Library for component tests
- Mock Gemini API calls for deterministic testing
- Test drag-and-drop interactions
- Test LocalStorage persistence

## Deployment (Replit)

The .replit file configures:
- Development: `npm run dev` on port 5000
- Production: `vite preview --host 0.0.0.0 --port 5000`
- Port mapping: 5000 → 80 (external)
- Autoscale deployment mode
- Modules: nodejs-20, web

## Common Patterns

### Adding a new component
1. Create in `components/` directory
2. Use functional component with TypeScript interface for props
3. Import types from `types.ts`
4. Follow existing pattern: proper semantic HTML, dark mode classes, accessibility

### Adding AI functionality
1. Add function to `services/geminiService.ts`
2. Define JSON schema for structured output using defineSchema()
3. Handle errors with try-catch
4. Call from App.tsx with loading/error state management

### Modifying data models
1. Update interfaces in `types.ts`
2. Update Gemini schemas in geminiService.ts to match
3. Consider migration path for existing LocalStorage data
4. Test with existing data in browser DevTools

## Known Limitations

- Single user per browser (no multi-device sync)
- Gemini API key exposed client-side (inherent limitation)
- No data export/backup functionality
- Tailwind CSS via CDN (not bundled)
- No offline support (requires network for AI features)
- No test coverage
