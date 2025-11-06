import { RawIdea, Theme, ChatMessage, IdeaAtom } from '../types';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000';

if (!BACKEND_API_URL) {
    throw new Error("VITE_BACKEND_API_URL environment variable is not set");
}

const handleApiError = async (response: Response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }
};

export const organizeIdeas = async (rawIdeas: RawIdea[]): Promise<Theme[]> => {
    if (rawIdeas.length === 0) return [];

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/organize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ rawIdeas }),
        });

        await handleApiError(response);
        const data = await response.json();
        
        return data.themes.map((theme: Omit<Theme, 'id'>) => ({
            ...theme,
            id: `theme-${Date.now()}-${Math.random()}`,
            ideaAtoms: theme.ideaAtoms.map((atom: Omit<IdeaAtom, 'id'>) => ({
                ...atom,
                id: `atom-${Date.now()}-${Math.random()}`,
            }))
        }));

    } catch (error) {
        console.error("Error organizing ideas:", error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error("Failed to organize ideas. Please check the console for details.");
    }
};

export const chatWithTheme = async (theme: Theme, history: ChatMessage[], newMessage: string): Promise<string> => {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ theme, history, newMessage }),
        });

        await handleApiError(response);
        const data = await response.json();
        return data.response;

    } catch (error) {
        console.error("Error chatting with theme:", error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error("Failed to get a response from the model.");
    }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/transcribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audioBase64, mimeType }),
        });

        await handleApiError(response);
        const data = await response.json();
        return data.transcription;

    } catch (error) {
        console.error("Error transcribing audio:", error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error("Failed to transcribe audio.");
    }
};

export const semanticSearch = async (query: string, ideas: RawIdea[], themes: Theme[]): Promise<{ideaIds: string[], themeIds: string[]}> => {
    if (!query.trim()) return { ideaIds: [], themeIds: [] };

    try {
        const response = await fetch(`${BACKEND_API_URL}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, ideas, themes }),
        });

        await handleApiError(response);
        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Error performing semantic search:", error);
        if (error instanceof Error) {
            throw new Error(error.message);
        }
        throw new Error("Failed to perform search.");
    }
};