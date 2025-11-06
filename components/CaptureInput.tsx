import React, { useState, useEffect, useRef } from 'react';
// FIX: Import Modality for Live API config.
import { GoogleGenAI, LiveSession, Blob, Modality } from '@google/genai';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';

interface CaptureInputProps {
  onNewIdea: (content: string, sourceType: 'text' | 'voice') => void;
  isProcessing: boolean;
}

// --- Audio Encoding Helpers for Gemini Live API ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

export const CaptureInput: React.FC<CaptureInputProps> = ({ onNewIdea, isProcessing }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  // FIX: Add state to track idea source for better UX.
  const [sourceType, setSourceType] = useState<'text' | 'voice'>('text');
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const cleanupAudioResources = () => {
    sessionPromiseRef.current?.then(session => session.close());
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    scriptProcessorRef.current?.disconnect();
    audioContextRef.current?.close();

    sessionPromiseRef.current = null;
    audioContextRef.current = null;
    scriptProcessorRef.current = null;
    mediaStreamRef.current = null;
  };

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      cleanupAudioResources();
    };
  }, []);

  const handleToggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      cleanupAudioResources();
    } else {
      setText(''); // Clear previous text
      // FIX: Set source type when recording starts.
      setSourceType('voice');
      setIsRecording(true);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // FIX: Create session promise before setting up audio processor to avoid race conditions.
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => console.log('Live session opened.'),
            onmessage: (message) => {
              if (message.serverContent?.inputTranscription) {
                const transcriptChunk = message.serverContent.inputTranscription.text;
                setText(prev => prev + transcriptChunk);
              }
            },
            onerror: (e) => {
              console.error('Live session error:', e);
              setIsRecording(false);
              cleanupAudioResources();
            },
            onclose: () => {
              console.log('Live session closed.');
            },
          },
          config: {
            // FIX: Add responseModalities as required by Live API guidelines.
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
          },
        });
        sessionPromiseRef.current = sessionPromise;
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // FIX: Add type assertion to handle vendor-prefixed webkitAudioContext.
        const context = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = context;
        
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createBlob(inputData);
          // FIX: Use session promise directly to send data, per guidelines.
          sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };
        
        source.connect(processor);
        processor.connect(context.destination);

      } catch (error) {
          console.error("Error setting up voice recording:", error);
          alert("Could not start recording. Please ensure microphone permissions are granted.");
          setIsRecording(false);
          cleanupAudioResources();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      // FIX: Use sourceType state to correctly label ideas from voice or text.
      onNewIdea(text.trim(), sourceType);
      setText('');
      // FIX: Reset source type to default after submission.
      setSourceType('text');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-4 shadow-sm dark:shadow-none">
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // FIX: Update source type when user types.
            setSourceType('text');
          }}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening..." : "What's on your mind? Type or record your idea..."}
          className="w-full px-2 py-1 bg-transparent focus:outline-none text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 resize-none text-lg"
          rows={4}
          disabled={isProcessing || isRecording}
        />
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse-fast'
                  : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Record Voice'}
            >
              {isRecording ? <StopIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
              <span>{isRecording ? 'Stop' : 'Record Voice'}</span>
            </button>
            <span className="text-xs text-stone-500 dark:text-stone-400">Press <kbd className="font-sans border rounded px-1.5 py-0.5 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">Cmd</kbd> + <kbd className="font-sans border rounded px-1.5 py-0.5 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">Enter</kbd> to save</span>
          </div>
          <button
            type="submit"
            disabled={!text.trim() || isProcessing || isRecording}
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
