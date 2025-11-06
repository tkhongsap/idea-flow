import { GoogleGenAI, Type } from "@google/genai";
import { RawIdea, Theme, ChatMessage, IdeaAtom } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const organizeIdeas = async (rawIdeas: RawIdea[]): Promise<Theme[]> => {
    if (rawIdeas.length === 0) return [];

    const prompt = `
        You are an expert personal assistant and strategist, specializing in synthesizing scattered thoughts into actionable, structured themes.
        Your task is to process a list of raw, timestamped 'idea dumps', understand their deeper meaning and both explicit and implicit connections, and organize them into insightful themes.

        Follow these critical steps:
        1.  **Deep Analysis & Connection Finding:** Read all the raw idea dumps. Look beyond keywords to understand the underlying concepts, user intent, and context. Actively search for non-obvious and implicit connections. For example, an idea about "a tool for waking up early" and "an app for better sleep" are both related to "Personal Health Routines". Similarly, an idea about "learning to cook" and another about "budgeting for groceries" could be linked under a theme of "Improving Home Life & Finances".
        2.  **Atomization:** For each raw idea dump, break it down into its core, distinct, self-contained thoughts. These are 'idea atoms'. For example, "I want to build a productivity app that helps people track habits and uses gamification" breaks down into three atoms: "mobile app development idea," "habit tracking feature," and "gamification for user engagement."
        3.  **Thematic Clustering:** Identify overarching themes that connect multiple idea atoms based on their semantic similarity and shared goals, not just shared words. A theme should represent a larger project, area of interest, or problem space that provides a framework for action.
        4.  **Insightful Enrichment:** For each theme, generate the following with high specificity and quality:
            *   **Title:** A concise, insightful title (3-6 words) that captures the essence of the theme.
            *   **Summary:** A short summary paragraph that synthesizes the core concept and its potential.
            *   **Tags:** 3-5 highly relevant, conceptual keyword tags. Tags should be hierarchical or categorical where possible (e.g., 'SaaS', 'Productivity', 'Time Management') rather than just repeating words from the text.
            *   **Action Items:** A list of concrete, first-step action items. Frame them as clear commands (e.g., 'Research competitor apps in the habit-tracking space' instead of 'Competitor research').
            *   **Questions:** A list of open-ended, provocative questions designed to stimulate deeper thinking and uncover blind spots (e.g., 'What is the unique value proposition compared to existing solutions?' instead of 'Are there other apps?').
        5.  **Assignment:** Group the idea atoms under their most relevant theme. An idea atom must belong to only one theme. Ensure every single raw idea dump is processed and all its atoms are assigned to a theme.
        
        Return the result as a JSON object that adheres to the provided schema. Do not include any explanatory text before or after the JSON.

        Here are the raw idea dumps to be processed:
        ${JSON.stringify(rawIdeas.map(({tags, ...rest}) => rest), null, 2)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: organizeSchema,
            },
        });

        const jsonString = response.text;
        const parsedResponse = JSON.parse(jsonString);
        
        // Add unique IDs to themes and atoms
        return parsedResponse.map((theme: Omit<Theme, 'id'>) => ({
            ...theme,
            id: `theme-${Date.now()}-${Math.random()}`,
            ideaAtoms: theme.ideaAtoms.map((atom: Omit<IdeaAtom, 'id'>) => ({
                ...atom,
                id: `atom-${Date.now()}-${Math.random()}`,
            }))
        }));

    } catch (error) {
        console.error("Error organizing ideas with Gemini:", error);
        throw new Error("Failed to organize ideas. Please check the console for details.");
    }
};

export const chatWithTheme = async (theme: Theme, history: ChatMessage[], newMessage: string): Promise<string> => {
    
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

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: chatHistory,
        config: {
          systemInstruction,
        }
      });
      return response.text;

    } catch (error) {
        console.error("Error chatting with theme:", error);
        throw new Error("Failed to get a response from the model.");
    }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
    try {
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

        return response.text;
    } catch (error) {
        console.error("Error transcribing audio:", error);
        throw new Error("Failed to transcribe audio.");
    }
};

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

export const semanticSearch = async (query: string, ideas: RawIdea[], themes: Theme[]): Promise<{ideaIds: string[], themeIds: string[]}> => {
    if (!query.trim()) return { ideaIds: [], themeIds: [] };

    const simplifiedIdeas = ideas.map(idea => ({ id: idea.id, content: idea.content }));
    const simplifiedThemes = themes.map(theme => ({ id: theme.id, title: theme.title, summary: theme.summary }));

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

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: searchSchema,
            },
        });
        const jsonString = response.text;
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error performing semantic search:", error);
        throw new Error("Failed to perform search.");
    }
};