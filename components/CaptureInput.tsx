
import React, { useState, useEffect, useRef } from 'react';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';
import { SendIcon } from './icons/SendIcon';

interface CaptureInputProps {
  onNewIdea: (content: string) => void;
  isProcessing: boolean;
}

// Check for SpeechRecognition API
// Fix: Cast window to `any` to access non-standard browser APIs `SpeechRecognition` and `webkitSpeechRecognition` without TypeScript errors.
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
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        setText(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
    };

    recognition.onend = () => {
        if(isRecording){ // restart if it stops unexpectedly
            recognition.start();
        }
    };
    
    // Cleanup on unmount
    return () => {
        recognition.stop();
    };
  }, [isRecording]);

  const handleToggleRecording = () => {
    if (!recognition) {
        alert("Sorry, your browser doesn't support speech recognition.");
        return;
    }
    if (isRecording) {
        recognition.stop();
        setIsRecording(false);
        if (text.trim()) {
            onNewIdea(text.trim());
            setText('');
        }
    } else {
        setText('');
        recognition.start();
        setIsRecording(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing) {
      onNewIdea(text.trim());
      setText('');
    }
  };
  
  return (
    <div className="sticky bottom-0 left-0 right-0 p-4 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={textInputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isRecording ? 'Listening...' : (isProcessing ? 'Processing ideas...' : 'Type or record your idea...')}
            className="flex-grow w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-primary text-gray-900 dark:text-gray-100 placeholder-gray-400"
            disabled={isProcessing}
          />
          <button
            type="button"
            onClick={handleToggleRecording}
            disabled={isProcessing}
            className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full transition-colors duration-200 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse-fast' 
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
            }`}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <StopIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6" />}
          </button>
          <button
            type="submit"
            disabled={!text.trim() || isProcessing}
            className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-brand-primary hover:bg-brand-secondary text-white transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            aria-label="Submit idea"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};
