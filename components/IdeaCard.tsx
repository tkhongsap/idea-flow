import React from 'react';
import { RawIdea } from '../types';
import { formatDistanceToNow } from '../utils/time';
import { TextIcon } from './icons/TextIcon';
import { MicIcon } from './icons/MicIcon';
import { ChatIcon } from './icons/ChatIcon';
import { TrashIcon } from './icons/TrashIcon';

type DraggedItem = { type: 'idea' | 'theme'; id: string };

interface IdeaCardProps {
  idea: RawIdea;
  onDelete: (id: string) => void;
  onChat: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  draggedItem: DraggedItem | null;
  setDraggedItem: (item: DraggedItem | null) => void;
}

export const IdeaCard: React.FC<IdeaCardProps> = ({ 
  idea, 
  onDelete, 
  onChat, 
  onReorder,
  draggedItem,
  setDraggedItem
}) => {
  const SourceIcon = idea.sourceType === 'voice' ? MicIcon : TextIcon;

  const handleDragStart = (e: React.DragEvent, idea: RawIdea) => {
    // FIX: Explicitly type the payload to ensure it matches the DraggedItem type.
    const payload: DraggedItem = { type: 'idea', id: idea.id };
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    setDraggedItem(payload);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIdea: RawIdea) => {
      e.preventDefault();
      try {
        const payload = JSON.parse(e.dataTransfer.getData('application/json'));
        if (payload.type === 'idea' && payload.id) {
            onReorder(payload.id, targetIdea.id);
        }
      } catch (error) {
        console.error("Failed to parse drag data:", error);
      }
  };

  const handleDragEnd = () => {
      setDraggedItem(null);
  };

  return (
    <div 
      draggable="true"
      onDragStart={(e) => handleDragStart(e, idea)}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, idea)}
      onDragEnd={handleDragEnd}
      className={`bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 flex flex-col gap-3 cursor-grab active:cursor-grabbing transition-opacity shadow-sm dark:shadow-none
        ${draggedItem?.id === idea.id ? 'opacity-40' : 'opacity-100'}
      `}
    >
      <p className="text-stone-800 dark:text-stone-200">{idea.content}</p>
      
      <div className="flex items-center gap-2 flex-wrap">
        {idea.tags && idea.tags.map(tag => (
          <span key={tag} className="px-2.5 py-0.5 text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full">{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mt-2">
        <div className="flex items-center gap-2 text-sm">
           <div className="flex items-center gap-1">
                <SourceIcon className="w-4 h-4" />
                <span>{idea.sourceType === 'voice' ? 'Voice' : 'Text'}</span>
           </div>
           <span>&middot;</span>
           <span>{formatDistanceToNow(idea.timestamp)}</span>
        </div>
        <div className="flex items-center gap-1">
            <button onClick={() => onChat(idea.id)} aria-label="Chat with idea" className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                <ChatIcon className="w-4 h-4" />
                <span className="text-sm">Chat</span>
            </button>
            <button onClick={() => onDelete(idea.id)} aria-label="Delete idea" className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-500 hover:text-red-500 dark:hover:text-red-500">
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
      </div>
    </div>
  );
};
