import React, { useState, useEffect, useRef } from 'react';
import { Theme, ChatMessage, RawIdea } from '../types';
import { chatWithTheme, transcribeAudio } from '../services/geminiService';
import { SendIcon } from './icons/SendIcon';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';
import { BrainIcon } from './icons/BrainIcon';
import { UserIcon } from './icons/UserIcon';
import { Waveform } from './Waveform';

interface ThemeDetailProps {
  theme: Theme;
  rawIdeas: RawIdea[];
  onBack: () => void;
  onAddIdeaAtom: (themeId: string, content: string) => void;
}

const SuggestionChip: React.FC<{ text: string, onClick: (text: string) => void }> = ({ text, onClick }) => (
    <button 
        onClick={() => onClick(text)}
        className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-sm"
    >
        {text}
    </button>
);

const FormattedContent: React.FC<{ text: string }> = ({ text }) => {
    // This function handles inline formatting like **bold**.
    const processInlineFormatting = (line: string): React.ReactNode => {
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(part => part);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };
    
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentListItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    
    // Helper to push the current list to the main elements array
    const flushList = () => {
        if (currentListItems.length > 0) {
            const listKey = `list-${elements.length}`;
            const className = "list-inside space-y-1 my-2 pl-4";
            if (listType === 'ul') {
                elements.push(<ul key={listKey} className={`list-disc ${className}`}>{currentListItems}</ul>);
            } else if (listType === 'ol') {
                elements.push(<ol key={listKey} className={`list-decimal ${className}`}>{currentListItems}</ol>);
            }
            currentListItems = [];
            listType = null;
        }
    };
    
    lines.forEach((line, index) => {
        const olMatch = line.match(/^\s*\d+\.\s+(.*)/);
        const ulMatch = line.match(/^\s*\*\s+(.*)/);
        
        if (olMatch) {
            if (listType !== 'ol') flushList(); // New list type, so flush old one
            listType = 'ol';
            currentListItems.push(<li key={index}>{processInlineFormatting(olMatch[1])}</li>);
        } else if (ulMatch) {
            if (listType !== 'ul') flushList(); // New list type, so flush old one
            listType = 'ul';
            // Treat nested lists as top-level for simplicity
            currentListItems.push(<li key={index}>{processInlineFormatting(ulMatch[1])}</li>);
        } else {
            flushList(); // End of a list, flush it
            if (line.trim()) {
                elements.push(<p key={index} className="my-1">{processInlineFormatting(line)}</p>);
            }
        }
    });
    
    flushList(); // Flush any list that is at the end of the text
    
    return <>{elements}</>;
};

const ChatInterface: React.FC<{ theme: Theme }> = ({ theme }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (messageContent?: string) => {
        const contentToSend = (messageContent || input).trim();
        if (!contentToSend || isLoading || isRecording || isTranscribing) return;

        const userMessage: ChatMessage = { role: 'user', content: contentToSend };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            const response = await chatWithTheme(theme, [...messages, userMessage], contentToSend);
            const modelMessage: ChatMessage = { role: 'model', content: response };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error)
 {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', content: 'Sorry, I had trouble responding. Please try again.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSend();
    };

    const handleToggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioContext;
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                source.connect(analyser);
                setAnalyserNode(analyser);

                const mimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
                const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
                if (!supportedMimeType) {
                    alert("Your browser doesn't support the required audio formats for recording.");
                    return;
                }
                
                mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = event => {
                    if (event.data.size > 0) audioChunksRef.current.push(event.data);
                };

                mediaRecorderRef.current.onstop = async () => {
                    setIsRecording(false);
                    setIsTranscribing(true);

                    const audioBlob = new Blob(audioChunksRef.current, { type: supportedMimeType });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        const base64Audio = (reader.result as string).split(',')[1];
                        try {
                            const transcription = await transcribeAudio(base64Audio, audioBlob.type);
                            setInput(prev => (prev ? prev + ' ' + transcription : transcription).trim());
                            textareaRef.current?.focus();
                        } catch (error) {
                            console.error("Transcription error:", error);
                            alert("Sorry, transcription failed.");
                        } finally {
                            setIsTranscribing(false);
                        }
                    };
                    stream.getTracks().forEach(track => track.stop());
                    audioContextRef.current?.close();
                    audioContextRef.current = null;
                    setAnalyserNode(null);
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (error) {
                console.error("Microphone access error:", error);
                alert("Microphone access was denied. Please allow it in your browser settings.");
            }
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
        const maxHeight = 200;
        target.style.height = `${Math.min(target.scrollHeight, maxHeight)}px`;
    };

    const initialSuggestions = [
        "What are the first steps?",
        "Identify potential risks.",
        "Who is the target audience?",
        "Brainstorm some alternative names.",
    ];

    return (
        <div className="mt-12">
            <div className="w-full max-w-3xl mx-auto space-y-6 pb-28">
                {messages.length === 0 && !isLoading && (
                     <div className="text-center pt-8 pb-4">
                        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-200">Chat about "{theme.title}"</h2>
                        <p className="text-stone-500 dark:text-stone-400 mt-2">Start a conversation or use a suggestion below.</p>
                        <div className="flex flex-wrap gap-2 justify-center mt-6">
                            {initialSuggestions.map(text => <SuggestionChip key={text} text={text} onClick={() => handleSend(text)} />)}
                        </div>
                    </div>
                )}
                
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><BrainIcon className="w-5 h-5"/></div>}
                         <div className={`max-w-xl p-3 rounded-xl ${msg.role === 'user' ? 'bg-sage text-white whitespace-pre-wrap' : 'bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700/80'}`}>
                            {msg.role === 'model' ? <FormattedContent text={msg.content} /> : msg.content}
                        </div>
                        {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center"><UserIcon className="w-5 h-5"/></div>}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3 justify-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><BrainIcon className="w-5 h-5 animate-pulse"/></div>
                        <div className="max-w-md p-3 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/80">
                        <div className="h-2 bg-stone-300 dark:bg-stone-600 rounded-full w-24 animate-pulse"></div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-stone-50 dark:from-stone-900 to-transparent pointer-events-none h-32"></div>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4">
                 <form 
                    onSubmit={handleFormSubmit} 
                    className="relative flex items-end gap-2 bg-white dark:bg-stone-800/90 backdrop-blur-sm border border-stone-200 dark:border-stone-700 rounded-2xl shadow-lg p-2"
                >
                    <div className="relative flex-grow">
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder={isRecording ? "Recording..." : isTranscribing ? "Transcribing..." : "Chat about this theme..."}
                            className="flex-grow w-full pl-3 pr-10 py-2.5 bg-transparent focus:outline-none text-stone-900 dark:text-stone-100 resize-none"
                            disabled={isLoading || isRecording || isTranscribing}
                        />
                         <button
                            type="button"
                            onClick={handleToggleRecording}
                            disabled={isLoading || isTranscribing}
                            className={`absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors
                            ${isRecording ? 'text-red-500 bg-red-500/10' : 'text-stone-500'} ${isTranscribing ? 'cursor-not-allowed' : ''}`}
                            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                        >
                             {isTranscribing ? <div className="w-5 h-5 border-2 border-stone-400/50 border-t-stone-500 rounded-full animate-spin"></div> : isRecording ? <StopIcon className="w-5 h-5"/> : <MicIcon className="w-5 h-5" />}
                        </button>
                        <div className="absolute bottom-1 left-2 right-2 pointer-events-none">
                            <Waveform analyserNode={analyserNode} isRecording={isRecording} />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading || isRecording || isTranscribing}
                        className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-sage hover:brightness-105 text-white transition-all duration-200 disabled:bg-stone-400 dark:disabled:bg-stone-600 disabled:cursor-not-allowed"
                        aria-label="Send message"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <SendIcon className="w-5 h-5" />
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