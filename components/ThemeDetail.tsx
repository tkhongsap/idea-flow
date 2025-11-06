import React, { useState, useEffect, useRef } from 'react';
import { Theme, ChatMessage, RawIdea } from '../types';
import { chatWithTheme } from '../services/geminiService';
import { SendIcon } from './icons/SendIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';

interface ThemeDetailProps {
  theme: Theme;
  rawIdeas: RawIdea[];
  onBack: () => void;
  onAddIdeaAtom: (themeId: string, content: string) => void;
}

const ChatInterface: React.FC<{ theme: Theme }> = ({ theme }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await chatWithTheme(theme, [...messages, userMessage], input);
            const modelMessage: ChatMessage = { role: 'model', content: response };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', content: 'Sorry, I had trouble responding. Please try again.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 mt-8 flex flex-col h-[60vh]">
            <h3 className="text-lg font-semibold p-4 border-b border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200">Chat with this theme</h3>
            <div className="flex-grow p-4 overflow-y-auto">
                {messages.length === 0 && (
                    <div className="text-center text-stone-500 dark:text-stone-400 h-full flex flex-col justify-center items-center">
                        <p>Ask questions to refine this theme.</p>
                        <p className="text-sm">e.g., "Summarize these ideas in one sentence."</p>
                    </div>
                )}
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 my-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><LightbulbIcon className="w-5 h-5"/></div>}
                        <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-sage text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200'}`}>
                           {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex items-start gap-3 my-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><LightbulbIcon className="w-5 h-5 animate-pulse"/></div>
                        <div className="max-w-md p-3 rounded-lg bg-stone-100 dark:bg-stone-800">
                           <div className="h-2 bg-stone-300 dark:bg-stone-600 rounded-full w-24 animate-pulse"></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-stone-200 dark:border-stone-800 flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a follow-up question..."
                    className="flex-grow w-full px-4 py-2 bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/50 rounded-full focus:outline-none focus:ring-2 focus:ring-sage text-stone-900 dark:text-stone-100"
                />
                <button type="submit" disabled={!input.trim() || isLoading} className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-sage hover:brightness-105 text-white transition-all duration-200 disabled:bg-stone-400 dark:disabled:bg-stone-600">
                    <SendIcon className="w-5 h-5"/>
                </button>
            </form>
        </div>
    );
};

export const ThemeDetail: React.FC<ThemeDetailProps> = ({ theme, rawIdeas, onBack, onAddIdeaAtom }) => {
    const getRawIdeaContent = (id: string) => {
        if (id.startsWith('manual-')) {
            return "Manually added idea.";
        }
        return rawIdeas.find(idea => idea.id === id)?.content || 'Original idea not found.';
    }
    const [newAtomContent, setNewAtomContent] = useState('');

    const handleAddAtomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAtomContent.trim()) {
            onAddIdeaAtom(theme.id, newAtomContent.trim());
            setNewAtomContent('');
        }
    };
    
    return (
        <div className="p-4 md:p-0 text-stone-900 dark:text-stone-100">
             <button onClick={onBack} className="mb-6 text-sage hover:underline">&larr; Back to all themes</button>

            <h1 className="text-4xl font-bold mb-2 text-stone-900 dark:text-stone-100">{theme.title}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
                {theme.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 text-sm bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full">{tag}</span>
                ))}
            </div>
            <p className="text-lg text-stone-600 dark:text-stone-300 mb-6 max-w-3xl">{theme.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {theme.actionItems.length > 0 && (
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-xl">
                        <h3 className="font-semibold text-stone-800 dark:text-stone-300 mb-2">Action Items</h3>
                        <ul className="list-disc list-inside space-y-1 text-stone-700 dark:text-stone-200">
                            {theme.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                )}
                 {theme.questions.length > 0 && (
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-xl">
                        <h3 className="font-semibold text-stone-800 dark:text-stone-300 mb-2">Questions</h3>
                        <ul className="list-disc list-inside space-y-1 text-stone-700 dark:text-stone-200">
                            {theme.questions.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-4 border-b pb-2 border-stone-200 dark:border-stone-800">Contained Ideas</h2>
                <div className="space-y-4">
                    {theme.ideaAtoms.length === 0 && (
                        <p className="text-stone-500 dark:text-stone-400 italic text-center py-4">No ideas have been added to this theme yet.</p>
                    )}
                    {theme.ideaAtoms.map(atom => (
                        <div key={atom.id} className="p-4 bg-stone-50/50 dark:bg-stone-800/50 rounded-lg border border-stone-200/80 dark:border-stone-800">
                            <p className="mb-2">{atom.content}</p>
                            <p className="text-xs text-stone-400 dark:text-stone-500 italic">From: "{getRawIdeaContent(atom.sourceIdeaId)}"</p>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleAddAtomSubmit} className="mt-6 flex items-center gap-2 p-2 bg-stone-100/60 dark:bg-stone-800/50 rounded-full border border-stone-200 dark:border-stone-700/50">
                    <input
                        type="text"
                        value={newAtomContent}
                        onChange={(e) => setNewAtomContent(e.target.value)}
                        placeholder="Add a new idea to this theme..."
                        className="flex-grow w-full px-4 py-2 bg-transparent focus:outline-none text-stone-900 dark:text-stone-100"
                    />
                    <button type="submit" aria-label="Add idea" disabled={!newAtomContent.trim()} className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-sage hover:brightness-105 text-white transition-all duration-200 disabled:bg-stone-400 dark:disabled:bg-stone-600">
                        <span className="text-2xl font-light">+</span>
                    </button>
                </form>
            </div>

            <ChatInterface theme={theme} />
        </div>
    );
};