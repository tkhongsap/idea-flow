---
description: Explain the AI organization system and Gemini integration
---

Explain how the AI-powered organization system works in IdeaFlow.

Please provide a detailed explanation covering:

1. **Gemini Service Architecture** (@services/geminiService.ts)
   - How the service is structured
   - The four main AI functions and their purposes
   - Structured output with JSON schemas

2. **Organization Flow**
   - How raw ideas are captured
   - The 2-second debounce mechanism
   - How ideas are broken into "idea atoms"
   - Theme clustering algorithm
   - Tag and action item generation

3. **Semantic Search**
   - How it differs from keyword search
   - Search implementation details
   - Result ranking and relevance

4. **Chat System**
   - Theme-based contextual brainstorming
   - Conversation history management
   - Integration with ThemeDetail component

5. **Audio Transcription**
   - Voice capture flow
   - Audio format handling
   - Base64 encoding process

6. **API Key Management**
   - Environment variable setup
   - Build-time injection via Vite
   - Client-side security considerations

Include code references and explain the data flow from user input to organized themes.
