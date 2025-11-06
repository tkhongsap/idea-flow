import React, { useState } from 'react';

interface CreateThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}

export const CreateThemeModal: React.FC<CreateThemeModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreate(title.trim());
      setTitle('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-stone-900 rounded-xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-stone-800 dark:text-stone-100">Create a New Theme</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="theme-title" className="sr-only">Theme Title</label>
          <input
            id="theme-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter theme title..."
            className="w-full px-4 py-2 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage text-stone-900 dark:text-stone-100"
            autoFocus
          />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-sage text-white rounded-lg hover:brightness-105 transition-all disabled:bg-stone-400 dark:disabled:bg-stone-500"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};