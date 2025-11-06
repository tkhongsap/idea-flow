
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-100">Create a New Theme</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="theme-title" className="sr-only">Theme Title</label>
          <input
            id="theme-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter theme title..."
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary text-gray-900 dark:text-gray-100"
            autoFocus
          />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-secondary transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-500"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
