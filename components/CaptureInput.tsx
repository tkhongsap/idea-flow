import React, { useState, useEffect, useRef } from 'react';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';

interface CaptureInputProps {
  onNewIdea: (content: string, sourceType: 'text' | 'voice') => void;
  isProcessing: boolean;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
}

export const CaptureInput: React.FC<CaptureInputProps> = ({ onNewIdea, isProcessing }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<string>(''); // Ref to hold the latest transcript

  useEffect(() => {
    if (!recognition) return;

    const handleResult = (event: any) => {
        const finalParts: string[] = [];
        let interimPart = '';
  
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalParts.push(transcript);
          } else {
            interimPart = transcript;
          }
        }
        
        const finalTranscript = finalParts.join(' ');
        const fullTranscript = finalTranscript + (finalTranscript && interimPart ? ' ' : '') + interimPart;
        
        setText(fullTranscript);
        transcriptRef.current = fullTranscript; // Always keep the ref updated
    };

    const handleError = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
    };
    
    const handleEnd = () => {
        setIsRecording(false);
    };

    recognition.addEventListener('result', handleResult);
    recognition.addEventListener('error', handleError);
    recognition.addEventListener('end', handleEnd);

    return () => {
        recognition.removeEventListener('result', handleResult);
        recognition.removeEventListener('error', handleError);
        recognition.removeEventListener('end', handleEnd);
        if (recognition.state === 'listening') {
          recognition.stop();
        }
    };
  }, []);

  const handleToggleRecording = () => {
    if (!recognition) {
        alert("Sorry, your browser doesn't support speech recognition.");
        return;
    }
    if (isRecording) {
        recognition.stop();
        // The stop action is now the trigger to submit the idea.
        // We use the ref to ensure we have the absolute latest transcript.
        if (transcriptRef.current.trim()) {
            onNewIdea(transcriptRef.current.trim(), 'voice');
            setText('');
            transcriptRef.current = '';
        }
    } else {
        setText('');
        transcriptRef.current = '';
        recognition.start();
        setIsRecording(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      onNewIdea(text.trim(), 'text');
      setText('');
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
                ref={textAreaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Listening..." : "What's on your mind? Type or record your idea..."}
                className="w-full px-2 py-1 bg-transparent focus:outline-none text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 resize-none text-lg"
                rows={4}
                disabled={isProcessing}
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
