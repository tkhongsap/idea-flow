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
    <div className="p-4 md:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4">
             <form onSubmit={handleSubmit}>
                <textarea
                    ref={textAreaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isRecording ? "Listening..." : "What's on your mind? Type or record your idea..."}
                    className="w-full px-2 py-1 bg-transparent focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none"
                    rows={4}
                    disabled={isProcessing}
                />
                <div className="flex justify-between items-center mt-2">
                    <div className="flex items-center gap-4">
                         <button
                            type="button"
                            onClick={handleToggleRecording}
                            disabled={isProcessing}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                            isRecording 
                                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse-fast' 
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                            }`}
                            aria-label={isRecording ? 'Stop recording' : 'Record Voice'}
                        >
                            {isRecording ? <StopIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                            <span>{isRecording ? 'Stop' : 'Record Voice'}</span>
                        </button>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Press <kbd className="font-sans border rounded px-1.5 py-0.5 border-gray-300 dark:border-gray-600">Cmd</kbd> + <kbd className="font-sans border rounded px-1.5 py-0.5 border-gray-300 dark:border-gray-600">Enter</kbd> to save</span>
                    </div>
                   
                    <button
                        type="submit"
                        disabled={!text.trim() || isProcessing || isRecording}
                        className="px-6 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                        aria-label="Capture Idea"
                    >
                        Capture Idea
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};
