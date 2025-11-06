import React from 'react';
import { RawIdea } from '../types';
import { formatDistanceToNow } from '../utils/time';
import { TextIcon } from './icons/TextIcon';
import { MicIcon } from './icons/MicIcon';
import { ChatIcon } from './icons/ChatIcon';
import { TrashIcon } from './icons/TrashIcon';

interface IdeaCardProps {
  idea: RawIdea;
  onDelete: (id: string) => void;
  onChat: (id: string) => void;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ idea, onDelete, onChat }) => {
  const SourceIcon = idea.sourceType === 'voice' ? MicIcon : TextIcon;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
      <p className="text-gray-800 dark:text-gray-200">{idea.content}</p>
      
      <div className="flex items-center gap-2 flex-wrap">
        {idea.tags && idea.tags.map(tag => (
          <span key={tag} className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mt-2">
        <div className="flex items-center gap-2 text-sm">
           <div className="flex items-center gap-1">
                <SourceIcon className="w-4 h-4" />
                <span>{idea.sourceType === 'voice' ? 'Voice' : 'Text'}</span>
           </div>
           <span>&middot;</span>
           <span>{formatDistanceToNow(idea.timestamp)}</span>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => onChat(idea.id)} aria-label="Chat with idea" className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <ChatIcon className="w-4 h-4" />
                <span className="text-sm">Chat</span>
            </button>
            <button onClick={() => onDelete(idea.id)} aria-label="Delete idea" className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <TrashIcon className="w-4 h-4" />
                <span className="text-sm">Delete</span>
            </button>
        </div>
      </div>
    </div>
  );
};
