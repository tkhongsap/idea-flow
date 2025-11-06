
import React from 'react';
import { Theme } from '../types';
import { UserIcon } from './icons/UserIcon';

interface ThemeListProps {
  themes: Theme[];
  onSelectTheme: (theme: Theme) => void;
  onOpenCreateThemeModal: () => void;
}

export const ThemeList: React.FC<ThemeListProps> = ({ themes, onSelectTheme, onOpenCreateThemeModal }) => {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Your Organized Themes</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          onClick={onOpenCreateThemeModal}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-brand-primary dark:hover:border-brand-primary transition-all duration-300 flex items-center justify-center flex-col min-h-[220px]"
          role="button"
          aria-label="Create a new theme"
        >
          <span className="text-brand-primary text-4xl mb-2" aria-hidden="true">+</span>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Create New Theme</h2>
        </div>
        
        {themes.map(theme => (
          <div
            key={theme.id}
            onClick={() => onSelectTheme(theme)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[220px]"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">{theme.title}</h2>
                {theme.isUserCreated && <UserIcon className="w-4 h-4 text-gray-400" title="User-created theme" />}
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-4 h-20 overflow-hidden text-ellipsis">{theme.summary || "No summary yet. Add ideas to this theme!"}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-auto">
              {theme.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
