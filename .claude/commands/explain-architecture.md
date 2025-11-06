---
description: Explain the application architecture and component structure
---

Explain the IdeaFlow application architecture and how components work together.

Please provide a comprehensive overview covering:

1. **Overall Architecture**
   - Frontend-only design (no backend)
   - React + TypeScript + Vite stack
   - LocalStorage persistence strategy
   - Deployment on Replit with autoscale

2. **State Management** (@App.tsx)
   - Core state structure (rawIdeas, themes, selectedTheme, searchResults)
   - State update patterns
   - Automatic LocalStorage sync
   - Data flow between components

3. **Component Hierarchy**
   - Input Layer: CaptureInput, ConversationView
   - Display Layer: IdeasList, ThemeList, ThemeDetail, IdeaCard
   - Interaction Layer: ChatInterface, CreateThemeModal
   - How components communicate with parent state

4. **Data Models** (@types.ts)
   - RawIdea structure and purpose
   - Theme structure and properties
   - IdeaAtom and linking to source ideas
   - Relationships between models

5. **Drag-and-Drop System**
   - Three supported operations
   - HTML5 Drag API implementation
   - State management during drag operations
   - Visual feedback system

6. **Key Features**
   - Dual input modes (text and voice)
   - Auto-organization with debouncing
   - Semantic search with Cmd+K
   - Theme-based chat and brainstorming
   - Voice conversation mode

7. **Technical Stack**
   - Vite configuration and build process
   - Tailwind CSS via CDN
   - MediaRecorder API for audio
   - Google Gemini 2.5 Flash integration

Include architecture diagrams (in text/ASCII), component relationships, and code references (file:line).
