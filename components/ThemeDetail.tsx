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
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const target = e.target;
        target.style.height = 'auto';
        const maxHeight = 200; // Prevent infinite growth
        target.style.height = `${Math.min(target.scrollHeight, maxHeight)}px`;
    };

    return (
        <div className="mt-12">
            <h3 className="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-200">Chat with this theme</h3>
            
            <div className={`transition-all duration-300 ${messages.length > 0 ? 'border-t border-stone-200 dark:border-stone-800 pt-6' : ''}`}>
                <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6">
                    {messages.length === 0 && !isLoading && (
                        <div className="text-center text-stone-500 dark:text-stone-400 py-8">
                            <LightbulbIcon className="w-10 h-10 mx-auto mb-2 text-stone-400"/>
                            <p className="font-medium">Explore Your Theme</p>
                            <p className="text-sm">Ask questions to refine your ideas.</p>
                        </div>
                    )}
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 my-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><LightbulbIcon className="w-5 h-5"/></div>}
                            <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-sage text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200'}`}>
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
            </div>

            <div className="mt-4">
                <form onSubmit={handleSend} className="relative">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a follow-up question, e.g., 'What are the risks?'"
                        className="w-full px-4 py-3 pr-14 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage text-stone-900 dark:text-stone-100 resize-none transition-all duration-200 leading-tight"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-sage hover:brightness-105 text-white transition-all duration-200 disabled:bg-stone-400 dark:disabled:bg-stone-600 disabled:cursor-not-allowed"
                        aria-label="Send message"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <SendIcon className="w-4 h-4" />
                        )}
                    </button>
                </form>
            </div>
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
        <div className="text-stone-900 dark:text-stone-100">
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
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-lg shadow-sm dark:shadow-none">
                        <h3 className="font-semibold text-stone-800 dark:text-stone-300 mb-2">Action Items</h3>
                        <ul className="list-disc list-inside space-y-1 text-stone-700 dark:text-stone-200">
                            {theme.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                    </div>
                )}
                 {theme.questions.length > 0 && (
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 rounded-lg shadow-sm dark:shadow-none">
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
