
import React from 'react';

// FIX: Update component to accept a 'title' prop to resolve the TypeScript error
// in ThemeList.tsx and improve accessibility by rendering a <title> element.
export const UserIcon: React.FC<{ className?: string; title?: string }> = ({ className, title }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={!title}
  >
    {title && <title>{title}</title>}
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
