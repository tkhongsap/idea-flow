import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, Blob, Modality, LiveServerMessage } from '@google/genai';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';
import { BrainIcon } from './icons/BrainIcon';
import { UserIcon } from './icons/UserIcon';

// --- Audio Encoding & Decoding Helpers for Gemini Live API ---
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

interface Turn {
    id: string;
    user: string;
    model: string;
}

export const ConversationView: React.FC = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<Turn[]>([]);
    const [currentTurn, setCurrentTurn] = useState<Omit<Turn, 'id'>>({ user: '', model: '' });

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const outputNodeRef = useRef<GainNode | null>(null);

    const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);

    const cleanupAudioResources = () => {
        console.log("Cleaning up audio resources...");
        sessionPromiseRef.current?.then(session => session.close());
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());

        scriptProcessorRef.current?.disconnect();
        if (inputAudioContextRef.current?.state !== 'closed') {
            inputAudioContextRef.current?.close();
        }
        if (outputAudioContextRef.current?.state !== 'closed') {
            outputAudioContextRef.current?.close();
        }
        
        for (const source of audioQueueRef.current.values()) {
            source.stop();
        }
        audioQueueRef.current.clear();

        sessionPromiseRef.current = null;
        mediaStreamRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        scriptProcessorRef.current = null;
        nextStartTimeRef.current = 0;
    };
    
    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            cleanupAudioResources();
        };
    }, []);

    const handleToggleConnection = async () => {
        if (isConnected || isConnecting) {
            setIsConnected(false);
            setIsConnecting(false);
            cleanupAudioResources();
            return;
        }

        setIsConnecting(true);
        setCurrentTurn({ user: '', model: '' });
        setConversationHistory([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        console.log('Live session opened.');
                        setIsConnecting(false);
                        setIsConnected(true);

                        // Setup output audio
                        const outContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        outputAudioContextRef.current = outContext;
                        outputNodeRef.current = outContext.createGain();
                        outputNodeRef.current.connect(outContext.destination);
                        
                        // Setup input audio
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaStreamRef.current = stream;
                        const inContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        inputAudioContextRef.current = inContext;
                        
                        const source = inContext.createMediaStreamSource(stream);
                        const processor = inContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = processor;

                        processor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(processor);
                        processor.connect(inContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            setCurrentTurn(prev => ({ ...prev, user: prev.user + text }));
                        }
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            setCurrentTurn(prev => ({ ...prev, model: prev.model + text }));
                        }
                        if (message.serverContent?.turnComplete) {
                            const lastTurn = { ...currentTurn };
                            setConversationHistory(prev => [
                                ...prev,
                                { ...lastTurn, id: `turn-${Date.now()}` }
                            ]);
                            setCurrentTurn({ user: '', model: '' });
                        }
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current && outputNodeRef.current) {
                            const outputAudioContext = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNodeRef.current);
                            source.addEventListener('ended', () => audioQueueRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            audioQueueRef.current.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                            for (const source of audioQueueRef.current.values()) {
                                source.stop();
                            }
                            audioQueueRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e) => {
                        console.error('Live session error:', e);
                        alert('An error occurred with the conversation. Please try again.');
                        setIsConnected(false);
                        setIsConnecting(false);
                        cleanupAudioResources();
                    },
                    onclose: () => {
                        console.log('Live session closed.');
                        setIsConnected(false);
                        setIsConnecting(false);
                        cleanupAudioResources();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: 'You are a friendly and helpful brainstorming partner named Flow. Keep your responses concise and conversational.'
                },
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (error) {
            console.error("Error starting conversation:", error);
            alert("Could not start conversation. Please ensure microphone permissions are granted.");
            setIsConnecting(false);
            setIsConnected(false);
            cleanupAudioResources();
        }
    };
    
    const renderStatus = () => {
        if (isConnecting) return "Connecting...";
        if (isConnected) return "Connected. Start speaking.";
        return "Start a conversation with your AI assistant.";
    }
    
    const renderTurn = (turn: Turn | Omit<Turn, 'id'>, key: string | number, isCurrent: boolean) => (
        <div key={key} className={`flex flex-col gap-4 ${isCurrent ? 'opacity-100' : 'opacity-100'}`}>
            {turn.user && (
                <div className="flex items-start gap-3 justify-end">
                    <div className="max-w-xl p-3 rounded-xl bg-sage text-white">
                        {turn.user}
                    </div>
                     <div className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center"><UserIcon className="w-5 h-5"/></div>
                </div>
            )}
             {turn.model && (
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sage text-white flex items-center justify-center"><BrainIcon className="w-5 h-5"/></div>
                    <div className="max-w-xl p-3 rounded-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700/50">
                        {turn.model}
                    </div>
                </div>
            )}
        </div>
    );
    
    return (
        <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-6 shadow-sm dark:shadow-none min-h-[60vh] flex flex-col">
            <div className="flex-grow overflow-y-auto pr-4 space-y-6">
                {conversationHistory.length === 0 && !currentTurn.user && !currentTurn.model && (
                     <div className="text-center py-20 px-6">
                        <BrainIcon className="w-16 h-16 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-stone-700 dark:text-stone-300">Ready to talk</h3>
                        <p className="text-stone-500 dark:text-stone-400 mt-1">Click the microphone to start your voice conversation.</p>
                     </div>
                )}
                {conversationHistory.map(turn => renderTurn(turn, turn.id, false))}
                {renderTurn(currentTurn, 'current', true)}
            </div>
            <div className="flex-shrink-0 pt-6 mt-4 border-t border-stone-200 dark:border-stone-800 flex flex-col items-center">
                <button
                    onClick={handleToggleConnection}
                    disabled={isConnecting}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out text-white
                    ${isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-sage hover:brightness-105'}
                    ${isConnecting ? 'bg-stone-400 cursor-not-allowed' : ''}
                    focus:outline-none focus:ring-4 focus:ring-opacity-50 ${isConnected ? 'focus:ring-red-400' : 'focus:ring-green-400'}`}
                    aria-label={isConnected ? 'Stop conversation' : 'Start conversation'}
                >
                    {isConnected && <span className="absolute inset-0 rounded-full bg-red-500 animate-pulse-fast"></span>}
                    {isConnecting ? (
                        <div className="w-8 h-8 border-4 border-white/50 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        isConnected ? <StopIcon className="w-8 h-8" /> : <MicIcon className="w-8 h-8" />
                    )}
                </button>
                <p className="mt-4 text-sm text-stone-500 dark:text-stone-400 h-5">
                    {renderStatus()}
                </p>
            </div>
        </div>
    );
};