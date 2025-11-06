import React, { useState, useEffect, useCallback } from 'react';
import { RawIdea, Theme, IdeaAtom } from './types';
import { organizeIdeas } from './services/geminiService';
import { CaptureInput } from './components/CaptureInput';
import { ThemeList } from './components/ThemeList';
import { ThemeDetail } from './components/ThemeDetail';
import { BrainIcon } from './components/icons/BrainIcon';
import { CreateThemeModal } from './components/CreateThemeModal';
import { IdeasList } from './components/IdeasList';
import { SearchIcon } from './components/icons/SearchIcon';

type View = 'ideas' | 'themes';

const App: React.FC = () => {
    const [rawIdeas, setRawIdeas] = useState<RawIdea[]>(() => {
        try {
            const savedIdeas = localStorage.getItem('ideaflow_rawIdeas');
            return savedIdeas ? JSON.parse(savedIdeas) : [];
        } catch (error) {
            console.error("Error loading raw ideas from localStorage:", error);
            return [];
        }
    });
    const [themes, setThemes] = useState<Theme[]>(() => {
        try {
            const savedThemes = localStorage.getItem('ideaflow_themes');
            return savedThemes ? JSON.parse(savedThemes) : [];
        } catch (error) {
            console.error("Error loading themes from localStorage:", error);
            return [];
        }
    });
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreateThemeModalOpen, setIsCreateThemeModalOpen] = useState(false);
    const [view, setView] = useState<View>('ideas');

    // Auto-save to localStorage whenever ideas or themes change
    useEffect(() => {
        try {
            localStorage.setItem('ideaflow_rawIdeas', JSON.stringify(rawIdeas));
            localStorage.setItem('ideaflow_themes', JSON.stringify(themes));
        } catch (error) {
            console.error("Error saving to localStorage:", error);
        }
    }, [rawIdeas, themes]);

    const processAndOrganizeIdeas = useCallback(async (ideasToProcess: RawIdea[]) => {
        const ideasWithoutTags = ideasToProcess.filter(idea => !idea.tags);
        if (ideasWithoutTags.length === 0) return;
        
        setIsProcessing(true);
        setError(null);
        try {
            const organizedThemes = await organizeIdeas(ideasWithoutTags);
            
            const ideaIdToTags = new Map<string, string[]>();
            organizedThemes.forEach(theme => {
                theme.ideaAtoms.forEach(atom => {
                    ideaIdToTags.set(atom.sourceIdeaId, theme.tags);
                });
            });

            setRawIdeas(prevIdeas => 
                prevIdeas.map(idea => ({
                    ...idea,
                    tags: idea.tags || ideaIdToTags.get(idea.id)
                }))
            );
            
            setThemes(prevThemes => [
                ...prevThemes.filter(t => t.isUserCreated),
                ...organizedThemes
            ]);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsProcessing(false);
        }
    }, []);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            const ideasToProcess = rawIdeas.filter(idea => !idea.tags);
            if (ideasToProcess.length > 0) {
                processAndOrganizeIdeas(ideasToProcess);
            }
        }, 2000);

        return () => clearTimeout(handler);
    }, [rawIdeas, processAndOrganizeIdeas]);

    const handleNewIdea = (content: string, sourceType: 'text' | 'voice') => {
        const newIdea: RawIdea = {
            id: `idea-${Date.now()}`,
            content,
            timestamp: new Date().toISOString(),
            sourceType,
        };
        setRawIdeas(prevIdeas => [...prevIdeas, newIdea]);
    };

    const handleSelectTheme = (theme: Theme) => {
        setSelectedTheme(theme);
    };

    const handleBackToList = () => {
        setSelectedTheme(null);
    };

    const handleCreateTheme = (title: string) => {
        const newTheme: Theme = {
            id: `theme-user-${Date.now()}`,
            title,
            summary: '',
            tags: [],
            ideaAtoms: [],
            actionItems: [],
            questions: [],
            isUserCreated: true,
        };
        setThemes(prevThemes => [...prevThemes, newTheme]);
        setIsCreateThemeModalOpen(false);
    };

    const handleAddIdeaAtom = (themeId: string, content: string) => {
        const newAtom: IdeaAtom = {
            id: `atom-manual-${Date.now()}`,
            content,
            sourceIdeaId: `manual-${themeId}`,
        };

        const updatedThemes = themes.map(theme => {
            if (theme.id === themeId) {
                return { ...theme, ideaAtoms: [...theme.ideaAtoms, newAtom] };
            }
            return theme;
        });

        setThemes(updatedThemes);

        if (selectedTheme && selectedTheme.id === themeId) {
            const updatedSelectedTheme = updatedThemes.find(t => t.id === themeId);
            if (updatedSelectedTheme) setSelectedTheme(updatedSelectedTheme);
        }
    };
    
    const handleDeleteIdea = (id: string) => {
        setRawIdeas(prev => prev.filter(idea => idea.id !== id));
        // Also remove from themes if it exists
        setThemes(prev => prev.map(theme => ({
            ...theme,
            ideaAtoms: theme.ideaAtoms.filter(atom => atom.sourceIdeaId !== id)
        })));
    };

    const handleChatWithIdea = (id: string) => {
        const theme = themes.find(t => t.ideaAtoms.some(a => a.sourceIdeaId === id));
        if (theme) {
            setSelectedTheme(theme);
        } else {
            alert("This idea hasn't been organized into a theme yet. Please wait a moment.");
        }
    };

    const renderView = () => {
        if (selectedTheme) {
            return <ThemeDetail 
                        theme={selectedTheme} 
                        rawIdeas={rawIdeas} 
                        onBack={handleBackToList} 
                        onAddIdeaAtom={handleAddIdeaAtom} 
                    />;
        }

        switch (view) {
            case 'ideas':
                return <IdeasList ideas={rawIdeas} onDeleteIdea={handleDeleteIdea} onChatWithIdea={handleChatWithIdea} />;
            case 'themes':
                return <ThemeList themes={themes} onSelectTheme={handleSelectTheme} onOpenCreateThemeModal={() => setIsCreateThemeModalOpen(true)} />;
            default:
                return null;
        }
    };

    const TabButton: React.FC<{
        targetView: View,
        label: string
    }> = ({ targetView, label }) => (
        <button
            onClick={() => setView(targetView)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
                view === targetView 
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100">
            <header className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 sticky top-0 z-10 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <BrainIcon className="w-8 h-8 text-brand-primary" />
                        <div>
                             <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">IdeaFlow</h1>
                             <p className="text-sm text-gray-500 dark:text-gray-400">Capture your thoughts, organize your ideas</p>
                        </div>
                    </div>
                     <div className="relative w-full max-w-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full bg-gray-100 dark:bg-gray-700 border border-transparent rounded-md pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <kbd className="inline-flex items-center border border-gray-300 dark:border-gray-500 rounded px-2 text-sm font-sans font-medium text-gray-400 dark:text-gray-400">⌘K</kbd>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="max-w-4xl w-full mx-auto">
                <CaptureInput onNewIdea={handleNewIdea} isProcessing={isProcessing} />

                <div className="px-4 md:px-6">
                    <div className="inline-flex items-center bg-gray-200 dark:bg-gray-800 p-1 rounded-lg">
                        <TabButton targetView="ideas" label="Ideas" />
                        <TabButton targetView="themes" label="Themes" />
                    </div>
                </div>
                
                {error && (
                    <div className="m-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                
                {renderView()}
            </main>
            
            <CreateThemeModal 
                isOpen={isCreateThemeModalOpen}
                onClose={() => setIsCreateThemeModalOpen(false)}
                onCreate={handleCreateTheme}
            />
        </div>
    );
};

export default App;