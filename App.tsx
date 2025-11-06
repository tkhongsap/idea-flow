import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RawIdea, Theme, IdeaAtom } from './types';
import { organizeIdeas, semanticSearch } from './services/geminiService';
import { CaptureInput } from './components/CaptureInput';
import { ThemeList } from './components/ThemeList';
import { ThemeDetail } from './components/ThemeDetail';
import { CreateThemeModal } from './components/CreateThemeModal';
import { IdeasList } from './components/IdeasList';
import { SearchIcon } from './components/icons/SearchIcon';
import { XIcon } from './components/icons/XIcon';
import { LightbulbIcon } from './components/icons/LightbulbIcon';


type View = 'ideas' | 'themes';
type SearchResults = { ideaIds: string[]; themeIds: string[] } | null;
type DraggedItem = { type: 'idea' | 'theme'; id: string };

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
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResults>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Drag and Drop State
    const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
    const [dragOverItem, setDragOverItem] = useState<DraggedItem | null>(null);


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
    
    // Cmd+K for search
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        setIsSearching(true);
        setError(null);
        try {
            const results = await semanticSearch(searchQuery, rawIdeas, themes);
            setSearchResults(results);
        } catch (e: any) {
            setError(e.message || "Search failed.");
        } finally {
            setIsSearching(false);
        }
    };
    
    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
    };
    
    // --- Drag and Drop Handlers ---
    const handleAddIdeaToTheme = (ideaId: string, themeId: string) => {
        const idea = rawIdeas.find(i => i.id === ideaId);
        if (!idea) return;

        const newAtom: IdeaAtom = {
            id: `atom-manual-${Date.now()}`,
            content: idea.content,
            sourceIdeaId: idea.id,
        };

        setThemes(prevThemes => prevThemes.map(theme => {
            if (theme.id === themeId) {
                if (theme.ideaAtoms.some(atom => atom.sourceIdeaId === ideaId)) {
                    return theme; // Avoid duplicates
                }
                return { ...theme, ideaAtoms: [...theme.ideaAtoms, newAtom] };
            }
            return theme;
        }));
    };

    const handleReorderIdeas = (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;
        setRawIdeas(prevIdeas => {
            const draggedIndex = prevIdeas.findIndex(i => i.id === draggedId);
            const targetIndex = prevIdeas.findIndex(i => i.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return prevIdeas;
            const newIdeas = [...prevIdeas];
            const [removed] = newIdeas.splice(draggedIndex, 1);
            newIdeas.splice(targetIndex, 0, removed);
            return newIdeas;
        });
    };

    const handleReorderThemes = (draggedId: string, targetId: string) => {
         if (draggedId === targetId) return;
         setThemes(prevThemes => {
            const draggedIndex = prevThemes.findIndex(t => t.id === draggedId);
            const targetIndex = prevThemes.findIndex(t => t.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return prevThemes;
            const newThemes = [...prevThemes];
            const [removed] = newThemes.splice(draggedIndex, 1);
            newThemes.splice(targetIndex, 0, removed);
            return newThemes;
         });
    };
    // --- End Drag and Drop Handlers ---

    const renderView = () => {
        if (selectedTheme) {
            return <ThemeDetail 
                        theme={selectedTheme} 
                        rawIdeas={rawIdeas} 
                        onBack={handleBackToList} 
                        onAddIdeaAtom={handleAddIdeaAtom} 
                    />;
        }

        const currentView = searchResults ? (searchResults.ideaIds.length > 0 ? 'ideas' : (searchResults.themeIds.length > 0 ? 'themes' : view)) : view;

        if (searchResults) {
            return (
                <div>
                    <h2 className="text-2xl font-bold mb-4">Search Results for "{searchQuery}"</h2>
                    {searchResults.ideaIds.length > 0 && 
                        <IdeasList 
                            ideas={rawIdeas} 
                            onDeleteIdea={handleDeleteIdea} 
                            onChatWithIdea={handleChatWithIdea} 
                            filterIds={searchResults.ideaIds} 
                            onReorder={handleReorderIdeas} 
                            draggedItem={draggedItem}
                            setDraggedItem={setDraggedItem}
                        />
                    }
                    {searchResults.themeIds.length > 0 && 
                        <ThemeList 
                            themes={themes} 
                            onSelectTheme={handleSelectTheme} 
                            onOpenCreateThemeModal={() => setIsCreateThemeModalOpen(true)} 
                            filterIds={searchResults.themeIds}
                            onAddIdeaToTheme={handleAddIdeaToTheme}
                            onReorder={handleReorderThemes}
                            draggedItem={draggedItem}
                            setDraggedItem={setDraggedItem}
                            dragOverItem={dragOverItem}
                            setDragOverItem={setDragOverItem}
                        />
                    }
                    {(searchResults.ideaIds.length === 0 && searchResults.themeIds.length === 0) && (
                        <div className="text-center py-16 text-stone-500 dark:text-stone-400">
                          <h3 className="text-lg font-semibold">No results found</h3>
                          <p>Try a different search query.</p>
                        </div>
                    )}
                </div>
            )
        }


        switch (view) {
            case 'ideas':
                return <IdeasList 
                            ideas={rawIdeas} 
                            onDeleteIdea={handleDeleteIdea} 
                            onChatWithIdea={handleChatWithIdea}
                            onReorder={handleReorderIdeas}
                            draggedItem={draggedItem}
                            setDraggedItem={setDraggedItem}
                        />;
            case 'themes':
                return <ThemeList 
                            themes={themes} 
                            onSelectTheme={handleSelectTheme} 
                            onOpenCreateThemeModal={() => setIsCreateThemeModalOpen(true)}
                            onAddIdeaToTheme={handleAddIdeaToTheme}
                            onReorder={handleReorderThemes}
                            draggedItem={draggedItem}
                            setDraggedItem={setDraggedItem}
                            dragOverItem={dragOverItem}
                            setDragOverItem={setDragOverItem}
                        />;
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
            className={`px-4 py-2 text-sm font-medium rounded-md font-sans ${
                view === targetView 
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' 
                : 'text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-stone-900 font-sans text-stone-900 dark:text-stone-100">
            <header className="px-4 pt-8 sm:pt-12">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <LightbulbIcon className="w-8 h-8 text-sage" />
                        <div>
                             <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">IdeaFlow</h1>
                             <p className="text-lg text-stone-500 dark:text-stone-400">Capture your thoughts, organize your ideas</p>
                        </div>
                    </div>
                    <form onSubmit={handleSearch} className="relative w-full max-w-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                           {isSearching ? (
                                <svg className="animate-spin h-5 w-5 text-stone-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <SearchIcon className="w-5 h-5 text-stone-400" />
                            )}
                        </div>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Semantic Search..."
                            className="w-full bg-stone-100 dark:bg-stone-700 border border-transparent rounded-md pl-10 pr-4 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-sage focus:border-transparent"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            {searchQuery ? (
                                <button type="button" onClick={clearSearch} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            ) : (
                                <kbd className="inline-flex items-center border border-stone-300 dark:border-stone-500 rounded px-2 text-sm font-sans font-medium text-stone-400 dark:text-stone-400">⌘K</kbd>
                            )}
                        </div>
                    </form>
                </div>
            </header>
            
            <main className="max-w-4xl w-full mx-auto px-4 py-8">
                <CaptureInput onNewIdea={handleNewIdea} isProcessing={isProcessing} />

                {!searchResults && (
                    <div className="mt-8">
                        <div className="inline-flex items-center bg-stone-200 dark:bg-stone-800 p-1 rounded-lg">
                            <TabButton targetView="ideas" label="Ideas" />
                            <TabButton targetView="themes" label="Themes" />
                        </div>
                    </div>
                )}
                
                {error && (
                    <div className="m-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}
                
                <div className="mt-6">
                    {renderView()}
                </div>
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
