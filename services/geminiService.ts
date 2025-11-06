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
        description: 'A list of 3-5 relevant keyword tags for the theme.'
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
        You are an expert personal assistant specializing in synthesizing and organizing scattered thoughts.
        I will provide you with a list of raw, timestamped 'idea dumps'. Your task is to process these dumps and organize them into structured themes.

        Follow these steps:
        1. Read all the raw idea dumps provided below. Each dump has a unique 'id'.
        2. Identify distinct, self-contained thoughts within each dump. Call these 'idea atoms'.
        3. Identify overarching themes or topics that connect multiple idea atoms.
        4. Group the related idea atoms under their respective themes. An idea atom can belong to only one theme.
        5. For each theme, create a concise, descriptive title, a short summary, 3-5 relevant keyword tags, and extract any potential 'action items' and 'questions'.
        6. Return the result as a JSON object that adheres to the provided schema. Ensure every raw idea dump is processed and its atoms are assigned to a theme.

        Here are the raw idea dumps:
        ${JSON.stringify(rawIdeas.map(({tags, ...rest}) => rest), null, 2)}

        Please provide the output in the specified JSON format.
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

    const systemInstruction = `You are a helpful assistant helping a user refine and explore their ideas.
    Your knowledge is strictly limited to the provided context about the theme.
    Use the context to answer questions, brainstorm, and elaborate on the user's thoughts.
    Keep your responses concise and directly related to the theme.

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