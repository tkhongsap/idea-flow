
import React from 'react';
import { Theme } from '../types';

interface ThemeListProps {
  themes: Theme[];
  onSelectTheme: (theme: Theme) => void;
}

export const ThemeList: React.FC<ThemeListProps> = ({ themes, onSelectTheme }) => {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Your Organized Themes</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map(theme => (
          <div
            key={theme.id}
            onClick={() => onSelectTheme(theme)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
          >
            <h2 className="text-xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">{theme.title}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4 h-20 overflow-hidden text-ellipsis">{theme.summary}</p>
            <div className="flex flex-wrap gap-2">
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
