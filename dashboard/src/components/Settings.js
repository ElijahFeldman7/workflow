import React, { useState } from 'react';

const Settings = ({ pageName }) => {
  const [isOpen, setIsOpen] = useState(false);

  // This function handles the logic that was likely repeated everywhere
  const toggleSettings = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* The Cog Button */}
      <button 
        onClick={toggleSettings}
        className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition-colors shadow-lg"
        aria-label="Open Settings"
      >
        {/* Simple Gear SVG Icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-6 w-6 text-gray-700 transform transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* The Dropdown / Modal Logic */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-xl py-1 border border-gray-200">
          <div className="px-4 py-2 text-sm text-gray-700 border-b font-bold">
            Settings
          </div>
          <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Display</a>
          <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Account</a>
          <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Log Out</a>
        </div>
      )}
    </div>
  );
};

export default Settings;