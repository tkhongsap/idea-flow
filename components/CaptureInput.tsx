import React, { useState, useRef } from 'react';
import { transcribeAudio } from '../services/geminiService';
import { MicIcon } from './icons/MicIcon';
import { StopIcon } from './icons/StopIcon';
import { Waveform } from './Waveform';

interface CaptureInputProps {
  onNewIdea: (content: string, sourceType: 'text' | 'voice') => void;
  isProcessing: boolean;
}

export const CaptureInput: React.FC<CaptureInputProps> = ({ onNewIdea, isProcessing }) => {
  const [text, setText] = useState('');
  const [sourceType, setSourceType] = useState<'text' | 'voice'>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

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

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
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
              setText(prev => (prev ? prev + ' ' + transcription : transcription).trim());
              setSourceType('voice');
            } catch (error) {
              console.error("Transcription error:", error);
              alert("Sorry, there was an error transcribing your voice memo.");
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
        alert("Microphone access was denied. Please allow microphone access in your browser settings to use this feature.");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isProcessing && !isRecording && !isTranscribing) {
      onNewIdea(text.trim(), sourceType);
      setText('');
      setSourceType('text');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setSourceType('text');
  };

  const getButtonText = () => {
    if (isTranscribing) return 'Transcribing...';
    if (isRecording) return 'Stop Recording';
    return 'Record Voice';
  }

  return (
    <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 p-4 shadow-sm dark:shadow-none">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Type or record a voice memo..."
            className="w-full h-24 px-2 py-1 bg-transparent focus:outline-none text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 resize-none text-lg"
            rows={4}
            disabled={isProcessing || isRecording || isTranscribing}
          />
          <div className="absolute bottom-1 left-2 right-2 pointer-events-none">
            <Waveform analyserNode={analyserNode} isRecording={isRecording} />
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleRecording}
              disabled={isProcessing || isTranscribing}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse-fast'
                  : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
              } ${isTranscribing ? 'cursor-not-allowed bg-stone-100 dark:bg-stone-800' : ''}`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isTranscribing ? <div className="w-4 h-4 border-2 border-stone-400/50 border-t-stone-500 rounded-full animate-spin"></div> : (isRecording ? <StopIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />) }
              <span>{getButtonText()}</span>
            </button>
            <span className="text-xs text-stone-500 dark:text-stone-400">Press <kbd className="font-sans border rounded px-1.5 py-0.5 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">Cmd</kbd> + <kbd className="font-sans border rounded px-1.5 py-0.5 border-stone-200 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-400">Enter</kbd> to save</span>
          </div>
          <button
            type="submit"
            disabled={!text.trim() || isProcessing || isRecording || isTranscribing}
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
