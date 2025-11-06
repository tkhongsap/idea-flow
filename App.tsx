
import React, { useState, useEffect, useCallback } from 'react';
import { RawIdea, Theme } from './types';
import { organizeIdeas } from './services/geminiService';
import { CaptureInput } from './components/CaptureInput';
import { ThemeList } from './components/ThemeList';
import { ThemeDetail } from './components/ThemeDetail';
import { BrainIcon } from './components/icons/BrainIcon';

const App: React.FC = () => {
    const [rawIdeas, setRawIdeas] = useState<RawIdea[]>([]);
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const processAndOrganizeIdeas = useCallback(async (ideas: RawIdea[]) => {
        if (ideas.length === 0) {
            setThemes([]);
            return;
        }
        setIsProcessing(true);
        setError(null);
        try {
            const organizedThemes = await organizeIdeas(ideas);
            setThemes(organizedThemes);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsProcessing(false);
        }
    }, []);
    
    useEffect(() => {
        // Debounce the processing to avoid too many API calls in quick succession
        const handler = setTimeout(() => {
            if (rawIdeas.length > 0) {
                processAndOrganizeIdeas(rawIdeas);
            }
        }, 1500); // 1.5 seconds after the last idea is added

        return () => {
            clearTimeout(handler);
        };
    }, [rawIdeas, processAndOrganizeIdeas]);

    const handleNewIdea = (content: string) => {
        const newIdea: RawIdea = {
            id: `idea-${Date.now()}`,
            content,
            timestamp: new Date().toISOString()
        };
        setRawIdeas(prevIdeas => [...prevIdeas, newIdea]);
    };

    const handleSelectTheme = (theme: Theme) => {
        setSelectedTheme(theme);
    };

    const handleBackToList = () => {
        setSelectedTheme(null);
    };

    const renderContent = () => {
        if (selectedTheme) {
            return <ThemeDetail theme={selectedTheme} rawIdeas={rawIdeas} onBack={handleBackToList} />;
        }
        
        if (isProcessing && themes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <BrainIcon className="w-16 h-16 text-brand-primary animate-pulse mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Organizing your thoughts...</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">The AI is clustering your ideas into themes.</p>
                </div>
            );
        }

        if (themes.length > 0) {
            return <ThemeList themes={themes} onSelectTheme={handleSelectTheme} />;
        }

        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                 <BrainIcon className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                 <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">Welcome to IdeaFlow</h2>
                 <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md">Capture your spontaneous ideas using the input below. They will be automatically organized into themes for you to explore.</p>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 font-sans">
            <header className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <BrainIcon className="w-8 h-8 text-brand-primary" />
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">IdeaFlow</h1>
                </div>
            </header>
            
            <main className="flex-grow max-w-7xl w-full mx-auto pb-24">
                {error && (
                    <div className="m-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                <div className="flex-grow h-full">
                    {renderContent()}
                </div>
            </main>
            
            <CaptureInput onNewIdea={handleNewIdea} isProcessing={isProcessing} />
        </div>
    );
};

export default App;
