import React from 'react';
import { RawIdea } from '../types';
import { IdeaCard } from './IdeaCard';

type DraggedItem = { type: 'idea' | 'theme'; id: string };

interface IdeasListProps {
  ideas: RawIdea[];
  onDeleteIdea: (id: string) => void;
  onChatWithIdea: (id: string) => void;
  filterIds?: string[];
  onReorder: (draggedId: string, targetId: string) => void;
  draggedItem: DraggedItem | null;
  setDraggedItem: (item: DraggedItem | null) => void;
}

export const IdeasList: React.FC<IdeasListProps> = ({ 
  ideas, 
  onDeleteIdea, 
  onChatWithIdea, 
  filterIds,
  onReorder,
  draggedItem,
  setDraggedItem
}) => {
  const isSearching = filterIds !== undefined;

  const displayedIdeas = isSearching
    ? [...ideas].filter(idea => filterIds.includes(idea.id))
    : [...ideas].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-4 md:p-0">
      <div className="space-y-4">
        {displayedIdeas.length === 0 ? (
           <div className="text-center py-20 px-6 bg-white dark:bg-stone-900/50 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl">
             <h3 className="text-lg font-semibold text-stone-700 dark:text-stone-300">{isSearching ? 'No ideas found' : 'No ideas yet'}</h3>
             <p className="text-stone-500 dark:text-stone-400 mt-1">{isSearching ? 'Your search did not match any ideas.' : 'Start capturing your thoughts using the quick capture above. Your ideas will appear here and be automatically organized into themes.'}</p>
           </div>
        ) : (
            displayedIdeas.map(idea => (
                <IdeaCard 
                  key={idea.id} 
                  idea={idea} 
                  onDelete={onDeleteIdea} 
                  onChat={onChatWithIdea}
                  onReorder={onReorder}
                  draggedItem={draggedItem}
                  setDraggedItem={setDraggedItem}
                />
            ))
        )}
      </div>
    </div>
  );
};