import React from 'react';
import { RawIdea } from '../types';
import { IdeaCard } from './IdeaCard';

interface IdeasListProps {
  ideas: RawIdea[];
  onDeleteIdea: (id: string) => void;
  onChatWithIdea: (id: string) => void;
  filterIds?: string[];
}

export const IdeasList: React.FC<IdeasListProps> = ({ ideas, onDeleteIdea, onChatWithIdea, filterIds }) => {
  const isSearching = filterIds !== undefined;

  const sortedIdeas = [...ideas]
    .filter(idea => isSearching ? filterIds.includes(idea.id) : true)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-4 md:p-6">
      {!isSearching && (
         <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            Recent Ideas 
            <span className="px-2 py-0.5 text-sm bg-gray-200 dark:bg-gray-700 rounded-full">{ideas.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <select className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option>All Sources</option>
              <option>Text</option>
              <option>Voice</option>
            </select>
            <select className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary">
              <option>Most Recent</option>
              <option>Oldest</option>
            </select>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {sortedIdeas.length === 0 ? (
           <div className="text-center py-16 text-gray-500 dark:text-gray-400">
             <h3 className="text-lg font-semibold">{isSearching ? 'No ideas found' : 'No ideas yet!'}</h3>
             <p>{isSearching ? 'Your search did not match any ideas.' : 'Use the input above to capture your first thought.'}</p>
           </div>
        ) : (
            sortedIdeas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onDelete={onDeleteIdea} onChat={onChatWithIdea} />
            ))
        )}
      </div>
    </div>
  );
};
