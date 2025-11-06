import React from 'react';
import { Theme } from '../types';
import { UserIcon } from './icons/UserIcon';

type DraggedItem = { type: 'idea' | 'theme'; id: string };

interface ThemeListProps {
  themes: Theme[];
  onSelectTheme: (theme: Theme) => void;
  onOpenCreateThemeModal: () => void;
  filterIds?: string[];
  onAddIdeaToTheme: (ideaId: string, themeId: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  draggedItem: DraggedItem | null;
  setDraggedItem: (item: DraggedItem | null) => void;
  dragOverItem: DraggedItem | null;
  setDragOverItem: (item: DraggedItem | null) => void;
}

export const ThemeList: React.FC<ThemeListProps> = ({ 
  themes, 
  onSelectTheme, 
  onOpenCreateThemeModal, 
  filterIds,
  onAddIdeaToTheme,
  onReorder,
  draggedItem,
  setDraggedItem,
  dragOverItem,
  setDragOverItem
}) => {
  const isSearching = filterIds !== undefined;
  const filteredThemes = isSearching 
    ? themes.filter(theme => filterIds!.includes(theme.id))
    : themes;

  const handleDragStart = (e: React.DragEvent, theme: Theme) => {
    // FIX: Explicitly type the payload to ensure it matches the DraggedItem type.
    const payload: DraggedItem = { type: 'theme', id: theme.id };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    setDraggedItem(payload);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetTheme: Theme) => {
    e.preventDefault();
    setDragOverItem(null);
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'));
      if (payload.type === 'theme' && payload.id) {
        onReorder(payload.id, targetTheme.id);
      } else if (payload.type === 'idea' && payload.id) {
        onAddIdeaToTheme(payload.id, targetTheme.id);
      }
    } catch (error) {
      console.error("Failed to parse drag data:", error)
    }
  };

  const handleDragEnter = (e: React.DragEvent, theme: Theme) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== theme.id) {
      setDragOverItem({ type: 'theme', id: theme.id });
    }
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverItem(null);
  }

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  }

  return (
    <div className="p-4 md:p-0">
      {filteredThemes.length === 0 && !isSearching && (
        <div className="text-center py-20 px-6 bg-white dark:bg-stone-900/50 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
          <h3 className="text-lg font-semibold text-stone-700 dark:text-stone-300">No themes yet</h3>
          <p className="text-stone-500 dark:text-stone-400 mt-1">Capture some ideas first, and they will be organized into themes here automatically.</p>
           <button onClick={onOpenCreateThemeModal} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-sage rounded-lg hover:brightness-105 transition-all">
                Create First Theme
            </button>
        </div>
      )}
      
      {filteredThemes.length === 0 && isSearching && (
        <div className="text-center py-16 text-stone-500 dark:text-stone-400">
          <h3 className="text-lg font-semibold">No themes found</h3>
          <p>Your search did not match any themes.</p>
        </div>
      )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {!isSearching && themes.length > 0 && (
            <div
              onClick={onOpenCreateThemeModal}
              className="bg-white dark:bg-stone-900/50 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-700 p-6 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:border-sage dark:hover:border-sage transition-all duration-300 flex items-center justify-center flex-col min-h-[220px]"
              role="button"
              aria-label="Create a new theme"
            >
              <span className="text-sage text-4xl mb-2" aria-hidden="true">+</span>
              <h2 className="text-lg font-semibold text-stone-700 dark:text-stone-300">Create New Theme</h2>
            </div>
          )}
          
          {filteredThemes.map(theme => (
            <div
              key={theme.id}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, theme)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, theme)}
              onDragEnter={(e) => handleDragEnter(e, theme)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectTheme(theme)}
              className={`bg-white dark:bg-stone-900 rounded-xl p-6 cursor-grab active:cursor-grabbing hover:border-stone-300 dark:hover:border-stone-600 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[220px] border-2
                ${draggedItem?.id === theme.id ? 'opacity-40' : ''}
                ${dragOverItem?.id === theme.id && draggedItem?.id !== theme.id
                  ? (draggedItem?.type === 'idea'
                    ? 'ring-2 ring-sage ring-offset-2 dark:ring-offset-stone-950 border-transparent'
                    : 'border-stone-400')
                  : 'border-stone-200 dark:border-stone-800'}
              `}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-stone-800 dark:text-stone-200">{theme.title}</h2>
                  {theme.isUserCreated && <UserIcon className="w-4 h-4 text-stone-400" title="User-created theme" />}
                </div>
                <p className="text-stone-600 dark:text-stone-300 mb-4 h-20 overflow-hidden text-ellipsis">{theme.summary || "No summary yet. Add ideas to this theme!"}</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-auto">
                {theme.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="px-3 py-1 text-xs bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
    </div>
  );
};