import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveSession, Blob, Modality, LiveServerMessage } from '@google/genai';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';
import { UserIcon } from './icons/UserIcon';
import { BrainIcon } from './icons/BrainIcon';

interface CaptureInputProps {
  onNewIdea: (content: string, sourceType: 'text' | 'voice') => void;
  isProcessing: boolean;
}

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

interface Turn {
  role: 'user' | 'model';
  content: string;
}

export const CaptureInput: React.FC<CaptureInputProps> = ({ onNewIdea, isProcessing }) => {
  const [text, setText] = useState('');
  const [isConversing, setIsConversing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [currentTurn, setCurrentTurn] = useState<{ user: string; model: string }>({ user: '', model: '' });

  // Live API refs
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const conversationEndRef = useRef<HTMLDivElement>(null);


  const cleanupAudioResources = () => {
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
    return () => cleanupAudioResources();
  }, []);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, currentTurn]);

  const handleToggleConversation = async () => {
    if (isConversing || isConnecting) {
      setIsConversing(false);
      setIsConnecting(false);
      cleanupAudioResources();

      // Format conversation into text
      const formatted = conversation.map(turn => `${turn.role === 'user' ? 'Me' : 'AI'}: ${turn.content}`).join('\n\n');
      setText(formatted);
      setConversation([]);
      setCurrentTurn({ user: '', model: '' });

    } else {
      setText('');
      setIsConnecting(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: async () => {
              setIsConnecting(false);
              setIsConversing(true);
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              mediaStreamRef.current = stream;
              // Setup audio contexts
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
                setCurrentTurn(prev => ({ ...prev, user: prev.user + message.serverContent.inputTranscription.text }));
              }
              if (message.serverContent?.outputTranscription) {
                setCurrentTurn(prev => ({ ...prev, model: prev.model + message.serverContent.outputTranscription.text }));
              }
              if (message.serverContent?.turnComplete) {
                setConversation(prev => [
                    ...prev,
                    { role: 'user', content: currentTurn.user },
                    { role: 'model', content: currentTurn.model }
                ].filter(t => t.content.trim() !== ''));
                setCurrentTurn({ user: '', model: '' });
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
              if (message.serverContent?.interrupted) {
                for (const source of audioQueueRef.current.values()) source.stop();
                audioQueueRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onerror: (e) => {
              console.error('Live session error:', e);
              alert('An error occurred. Please try again.');
              setIsConnecting(false);
              setIsConversing(false);
              cleanupAudioResources();
            },
            onclose: () => {
              setIsConnecting(false);
              setIsConversing(false);
              // Do not cleanup here, as user might have clicked stop intentionally
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: 'You are a friendly and helpful brainstorming partner. Help the user explore and refine their initial thoughts.'
          },
        });
        sessionPromiseRef.current = sessionPromise;
      } catch (error) {
        console.error("Error starting conversation:", error);
        alert("Could not start recording. Please ensure microphone permissions are granted.");
        setIsConnecting(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      onNewIdea(text.trim(), 'voice');
      setText('');
      if (isConversing) {
        handleToggleConversation();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };
  
  const renderConversation = () => (
    <div className="h-48 overflow-y-auto p-2 space-y-4 rounded-md bg-stone-50 dark:bg-stone-800/50">
      {[...conversation, {role: 'user', content: currentTurn.user}, {role: 'model', content: currentTurn.model}].map((turn, index) => (
        turn.content.trim() && (
          <div key={index} className={`flex items-start gap-2 ${turn.role === 'user' ? 'justify-end' : ''}`}>
            {turn.role === 'model' && <BrainIcon className="w-5 h-5 flex-shrink-0 text-sage" />}
            <p className={`max-w-md text-sm p-2 rounded-lg ${turn.role === 'user' ? 'bg-sage text-white' : 'bg-white dark:bg-stone-700'}`}>{turn.content}</p>
            {turn.role === 'user' && <UserIcon className="w-5 h-5 flex-shrink-0 text-stone-500" />}
          </div>
        )
      ))}
       <div ref={conversationEndRef} />
    </div>
  );

  return (
    <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-4 shadow-sm dark:shadow-none">
      <form onSubmit={handleSubmit}>
        {isConversing || isConnecting ? renderConversation() : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Type or start a conversation..."
            className="w-full h-24 px-2 py-1 bg-transparent focus:outline-none text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 resize-none text-lg"
            rows={4}
            disabled={isProcessing}
          />
        )}
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleConversation}
              disabled={isProcessing || isConnecting}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isConversing || isConnecting
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse-fast'
                  : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
              }`}
              aria-label={isConversing ? 'Stop conversation' : 'Start conversation'}
            >
              {isConnecting ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : (isConversing ? <StopIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />) }
              <span>{isConversing ? 'Stop & Finish' : (isConnecting ? 'Connecting...' : 'Record Voice')}</span>
            </button>
            <span className="text-xs text-stone-500 dark:text-stone-400">Press <kbd className="font-sans border rounded px-1.5 py-0.5 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">Cmd</kbd> + <kbd className="font-sans border rounded px-1.5 py-0.5 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">Enter</kbd> to save</span>
          </div>
          <button
            type="submit"
            disabled={!text.trim() || isProcessing || isConversing}
            className="px-6 py-2 rounded-lg bg-sage text-white font-semibold hover:brightness-105 transition-all duration-200 disabled:bg-stone-300 dark:disabled:bg-stone-600 disabled:cursor-not-allowed"
            aria-label="Capture Idea"
          >
            Capture Idea
          </button>
        </div>
      </form>
    </div>
  );
};
