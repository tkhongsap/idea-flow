import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is not set!');
  console.error('Please add your Gemini API key to Replit Secrets.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json({ limit: '10mb' }));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5000',
      'http://localhost:3000'
    ].filter(Boolean);
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

const organizeSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'A concise, descriptive title for the theme, 3-6 words long.'
      },
      summary: {
        type: Type.STRING,
        description: 'A short paragraph summarizing the core idea of the theme.'
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of 3-5 relevant keyword tags for the theme. Tags should represent concepts, not just words from the text.'
      },
      ideaAtoms: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: {
              type: Type.STRING,
              description: 'The distilled, single-thought content of the idea atom.'
            },
            sourceIdeaId: {
              type: Type.STRING,
              description: 'The ID of the original raw idea dump this atom came from.'
            }
          },
          required: ['content', 'sourceIdeaId']
        },
        description: 'A list of distinct, self-contained thoughts ("idea atoms") belonging to this theme.'
      },
      actionItems: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of potential action items extracted from the ideas in this theme.'
      },
      questions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'A list of questions raised by the ideas in this theme.'
      }
    },
    required: ['title', 'summary', 'tags', 'ideaAtoms', 'actionItems', 'questions']
  }
};

app.post('/api/organize', async (req, res) => {
  try {
    const { rawIdeas } = req.body;
    
    if (!rawIdeas || !Array.isArray(rawIdeas) || rawIdeas.length === 0) {
      return res.status(400).json({ error: 'rawIdeas array is required and cannot be empty' });
    }

    const prompt = `
        You are an expert personal assistant and strategist, specializing in synthesizing scattered thoughts into actionable, structured themes.
        Your task is to process a list of raw, timestamped 'idea dumps', understand their deeper meaning and both explicit and implicit connections, and organize them into insightful themes.

        **Key Principles:**
        1.  **Identify Themes:** Find recurring patterns, concepts, or related topics across the ideas. A theme is a conceptual cluster, not just a keyword match.
        2.  **Create 'Idea Atoms':** Break down each raw idea dump into distinct, self-contained, single thoughts called "idea atoms."
            * An idea atom is *one* core piece of information or insight. Do NOT use incomplete sentence fragment. 
            * It should be understandable on its own without needing the surrounding context from the raw dump.
            * IMPORTANT: You MUST preserve critical details (like specific names, numbers, dates, data, or unique contexts) when creating idea atoms.
                * For example, if a raw idea says "Meeting with Sarah Johnson on Tuesday at 2pm to discuss Q3 budget increase of 15%", the idea atom should be "Meeting with Sarah Johnson on Tuesday at 2pm to discuss Q3 budget increase of 15%", NOT a vague "Meeting scheduled" or "Discuss budget".
                * If a raw idea says "The new GraphQL API endpoint '/api/v2/users' is returning 500 errors for requests with pagination parameters", the idea atom should preserve the endpoint, error code, and context: "The GraphQL API endpoint '/api/v2/users' returns 500 errors when pagination parameters are included in requests."
            * If a raw idea contains multiple distinct thoughts, extract each as a separate idea atom.
            * If a raw idea is already a single, focused thought, it can become a single idea atom (with details preserved).
            * Link each idea atom to the source raw idea's ID using the \`sourceIdeaId\` field.
        3.  **Synthesize Themes:** For each theme:
            * Create a descriptive and specific \`title\` (3-6 words). Titles should be informative and capture the essence of the theme, not generic labels like "Theme 1".
            * Write a clear \`summary\` paragraph explaining the core concept of the theme and why these idea atoms belong together.
            * Assign 3-5 relevant \`tags\` that represent the key concepts or categories.
            * Populate \`ideaAtoms\` with the specific idea atoms (with preserved details) that belong to this theme.
            * Extract concrete \`actionItems\` from the ideas - these should be specific, actionable steps, not vague suggestions.
            * Identify meaningful \`questions\` that arise from the theme - thought-provoking inquiries that push exploration further.
        4.  **Maintain Fidelity:** Ensure the original meaning, nuance, and *specific details* of the user's ideas are preserved. Do not lose critical information.

        **Input Data:**
        Raw Idea Dumps (JSON):
        \`\`\`json
        ${JSON.stringify(rawIdeas, null, 2)}
        \`\`\`

        **Output:**
        Return a JSON array of theme objects, each conforming to the defined schema. Be insightful, specific, and preserve all important details from the raw ideas.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: organizeSchema,
      },
    });

    const themes = JSON.parse(response.text);
    res.json({ themes });
    
  } catch (error) {
    console.error('Error organizing ideas:', error);
    res.status(500).json({ 
      error: 'Failed to organize ideas', 
      details: error.message 
    });
  }
});

const searchSchema = {
  type: Type.OBJECT,
  properties: {
    ideaIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of IDs of the raw ideas that are most semantically relevant to the user's query."
    },
    themeIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "An array of IDs of the themes that are most semantically relevant to the user's query."
    }
  },
  required: ['ideaIds', 'themeIds']
};

app.post('/api/search', async (req, res) => {
  try {
    const { query, ideas, themes } = req.body;
    
    if (!query || !query.trim()) {
      return res.json({ ideaIds: [], themeIds: [] });
    }
    
    if (!ideas || !Array.isArray(ideas)) {
      return res.status(400).json({ error: 'ideas array is required' });
    }
    
    if (!themes || !Array.isArray(themes)) {
      return res.status(400).json({ error: 'themes array is required' });
    }

    const simplifiedIdeas = ideas.map(idea => ({ id: idea.id, content: idea.content }));
    const simplifiedThemes = themes.map(theme => ({ 
      id: theme.id, 
      title: theme.title, 
      summary: theme.summary 
    }));

    const prompt = `
        You are a semantic search engine. Your task is to find the most relevant ideas and themes from the provided data that match the user's search query.
        Relevance should be based on the conceptual meaning and intent, not just keyword matching.

        For example, if the user searches for "improving focus", an idea about a "distraction-free writing app" is highly relevant, even if it doesn't contain the word "focus".

        User Search Query: "${query}"

        Available Data:
        - Raw Ideas: ${JSON.stringify(simplifiedIdeas, null, 2)}
        - Themes: ${JSON.stringify(simplifiedThemes, null, 2)}

        Analyze the query and the data, and return a JSON object containing the IDs of the top 5 most relevant ideas and top 5 most relevant themes. If no relevant items are found, return empty arrays.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: searchSchema,
      },
    });

    const results = JSON.parse(response.text);
    res.json(results);
    
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ 
      error: 'Failed to perform search', 
      details: error.message 
    });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { theme, history, newMessage } = req.body;
    
    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }
    
    if (!newMessage || !newMessage.trim()) {
      return res.status(400).json({ error: 'newMessage is required' });
    }
    
    if (!Array.isArray(history)) {
      return res.status(400).json({ error: 'history must be an array' });
    }

    const context = `
      Theme Title: ${theme.title}
      Theme Summary: ${theme.summary}
      Tags: ${theme.tags.join(', ')}
      Contained Ideas:
      ${theme.ideaAtoms.map(atom => `- ${atom.content}`).join('\n')}
      Action Items: ${theme.actionItems.join(', ') || 'None'}
      Questions: ${theme.questions.join(', ') || 'None'}
    `;

    const systemInstruction = `You are a creative partner and brainstorming assistant. Your goal is to help the user explore the full potential of their ideas within the given theme.
    Use the provided context as a starting point, but do not be limited by it.
    Your role is to be provocative, insightful, and inspiring.
    - Ask clarifying and expansive questions (e.g., "What's the core problem this idea solves?", "Who would benefit most from this?").
    - Suggest alternative angles and novel connections to other concepts.
    - Identify potential challenges or blind spots in the user's thinking.
    - Help the user elaborate and build upon their initial thoughts.
    Keep your responses concise, engaging, and focused on pushing the user's thinking forward.

    CONTEXT:
    ${context}`;

    const chatHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));
    chatHistory.push({ role: 'user', parts: [{ text: newMessage }] });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: chatHistory,
      config: {
        systemInstruction,
      }
    });

    res.json({ response: response.text });
    
  } catch (error) {
    console.error('Error chatting with theme:', error);
    res.status(500).json({ 
      error: 'Failed to get a response from the model', 
      details: error.message 
    });
  }
});

app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    
    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }
    
    if (!mimeType) {
      return res.status(400).json({ error: 'mimeType is required' });
    }

    const audioPart = {
      inlineData: {
        data: audioBase64,
        mimeType,
      },
    };
    
    const textPart = {
      text: "Transcribe this audio recording accurately. Only return the transcribed text, without any introductory phrases like 'The transcription is:'.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [audioPart, textPart] },
    });

    res.json({ transcription: response.text });
    
  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe audio', 
      details: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'IdeaFlow Backend API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'IdeaFlow Backend API',
    endpoints: [
      'POST /api/organize - Organize raw ideas into themes',
      'POST /api/search - Semantic search across ideas and themes',
      'POST /api/chat - Chat with a theme',
      'POST /api/transcribe - Transcribe audio to text',
      'GET /api/health - Health check'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ IdeaFlow Backend API running on port ${PORT}`);
  console.log(`🔒 API Key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
});
