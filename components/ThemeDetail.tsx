import React, { useState, useEffect, useRef } from 'react';
import { Theme, ChatMessage, RawIdea } from '../types';
import { chatWithTheme } from '../services/geminiService';
import { SendIcon } from './icons/SendIcon';
import { MicIcon } from './icons/MicIcon';
import { GoogleGenAI, LiveSession, Blob, Modality, LiveServerMessage } from '@google/genai';
import { BrainIcon } from './icons/BrainIcon';
import { UserIcon } from './icons/UserIcon';

// --- Audio Encoding & Decoding Helpers ---
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}
// ---------------------------------------------------


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
    const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Live API Refs
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);
    const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const currentTurnRef = useRef<{ user: ChatMessage | null, model: ChatMessage | null }>({ user: null, model: null });

    const cleanupAudioResources = () => {
        sessionPromiseRef.current?.then(session => session.close());
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        if (inputAudioContextRef.current?.state !== 'closed') inputAudioContextRef.current?.close();
        if (outputAudioContextRef.current?.state !== 'closed') outputAudioContextRef.current?.close();
        for (const source of audioQueueRef.current.values()) source.stop();
        audioQueueRef.current.clear();
        sessionPromiseRef.current = null;
        mediaStreamRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        scriptProcessorRef.current = null;
        nextStartTimeRef.current = 0;
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        // Cleanup on unmount
        return () => cleanupAudioResources();
    }, []);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading || isVoiceChatActive) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        if (textareaRef.current) textareaRef.current.style.height = 'auto';

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

    const handleToggleVoiceChat = async () => {
        if (isVoiceChatActive) {
            setIsVoiceChatActive(false);
            cleanupAudioResources();
        } else {
            setIsVoiceChatActive(true);
            const systemInstruction = `You are a creative partner exploring a specific theme.
            CONTEXT:
            Theme Title: ${theme.title}
            Summary: ${theme.summary}
            Contained Ideas: ${theme.ideaAtoms.map(a => a.content).join(', ')}`;
            
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const sessionPromise = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: async () => {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            mediaStreamRef.current = stream;
                            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                            outputNodeRef.current = outputAudioContextRef.current.createGain();
                            outputNodeRef.current.connect(outputAudioContextRef.current.destination);
                            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
                            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current = processor;
                            processor.onaudioprocess = (e) => {
                                const inputData = e.inputBuffer.getChannelData(0);
                                sessionPromise.then((session) => session.sendRealtimeInput({ media: createBlob(inputData) }));
                            };
                            source.connect(processor);
                            processor.connect(inputAudioContextRef.current.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                            if (message.serverContent?.inputTranscription) {
                                const text = message.serverContent.inputTranscription.text;
                                setMessages(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last?.role === 'user' && currentTurnRef.current.user) {
                                        last.content += text;
                                        return [...prev];
                                    } else {
                                        const newUserMessage: ChatMessage = { role: 'user', content: text };
                                        currentTurnRef.current.user = newUserMessage;
                                        return [...prev, newUserMessage];
                                    }
                                });
                            }
                            if (message.serverContent?.outputTranscription) {
                                const text = message.serverContent.outputTranscription.text;
                                 setMessages(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last?.role === 'model' && currentTurnRef.current.model) {
                                        last.content += text;
                                        return [...prev];
                                    } else {
                                        const newModelMessage: ChatMessage = { role: 'model', content: text };
                                        currentTurnRef.current.model = newModelMessage;
                                        return [...prev, newModelMessage];
                                    }
                                });
                            }
                            if (message.serverContent?.turnComplete) {
                                currentTurnRef.current = { user: null, model: null };
                            }
                            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
                                const outCtx = outputAudioContextRef.current;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                                const source = outCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputNodeRef.current);
                                source.addEventListener('ended', () => audioQueueRef.current.delete(source));
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                audioQueueRef.current.add(source);
                            }
                        },
                        onerror: (e) => { console.error('Live session error:', e); setIsVoiceChatActive(false); cleanupAudioResources(); },
                        onclose: () => { setIsVoiceChatActive(false); cleanupAudioResources(); },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                        systemInstruction,
                    },
                });
                sessionPromiseRef.current = sessionPromise;
            } catch (error) {
                console.error("Error starting voice chat:", error);
                alert("Could not start voice chat. Please ensure microphone permissions are granted.");
                setIsVoiceChatActive(false);
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

    return (
        <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-200">Chat with this theme</h3>
            <div className="border border-stone-200 dark:border-stone-800 rounded-lg shadow-sm flex flex-col bg-white dark:bg-stone-900 h-[70vh] max-h-[800px]">
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 && !isLoading && (
                         <div className="flex flex-col items-center justify-center h-full text-center text-stone-500 dark:text-stone-400">
                            <BrainIcon className="w-12 h-12 mb-2 text-stone-300 dark:text-stone-600" />
                            <p>Ask questions or brainstorm ideas about this theme.</p>
                            <p className="text-sm">You can type or use the microphone.</p>
                        </div>
                    )}
                    
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 my-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                             {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><BrainIcon className="w-5 h-5"/></div>}
                             <div className={`max-w-xl p-3 rounded-xl ${msg.role === 'user' ? 'bg-sage text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200'}`}>
                                {msg.content}
                            </div>
                            {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center"><UserIcon className="w-5 h-5"/></div>}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3 my-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><BrainIcon className="w-5 h-5 animate-pulse"/></div>
                            <div className="max-w-md p-3 rounded-xl bg-stone-100 dark:bg-stone-800">
                            <div className="h-2 bg-stone-300 dark:bg-stone-600 rounded-full w-24 animate-pulse"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="flex-shrink-0 p-4 border-t border-stone-200 dark:border-stone-800">
                    <form 
                        onSubmit={handleSend} 
                        className="flex items-end gap-2"
                    >
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            placeholder={isVoiceChatActive ? "Listening..." : "Ask a follow-up question..."}
                            className="flex-grow w-full px-4 py-2.5 bg-stone-100 dark:bg-stone-800/80 border border-transparent focus:border-transparent focus:ring-2 focus:ring-sage rounded-xl text-stone-900 dark:text-stone-100 resize-none"
                            disabled={isVoiceChatActive}
                        />
                        <button
                            type="button"
                            onClick={handleToggleVoiceChat}
                            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors
                            ${isVoiceChatActive ? 'text-red-500 bg-red-500/10' : 'text-stone-500'}`}
                            aria-label={isVoiceChatActive ? 'Stop voice chat' : 'Start voice chat'}
                        >
                             <MicIcon className="w-5 h-5" />
                        </button>
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading || isVoiceChatActive}
                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-sage hover:brightness-105 text-white transition-all duration-200 disabled:bg-stone-400 dark:disabled:bg-stone-600 disabled:cursor-not-allowed"
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