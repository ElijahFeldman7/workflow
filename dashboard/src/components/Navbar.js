import React, { useState } from 'react';
import { logout } from '../firebase';


const Navbar = ({ activeTab, setActiveTab, navItems, user }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fallbackAvatar = typeof user?.displayName === 'string'
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}`
    : 'https://ui-avatars.com/api/?name=User';

  const profileSrc = user?.photoURL || (user?.providerData && user.providerData[0] && user.providerData[0].photoURL) || fallbackAvatar;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <div className="flex items-center gap-6">
            <div 
              className="flex-shrink-0 flex items-center cursor-pointer gap-3" 
              onClick={() => setActiveTab('tasks')}
            >
              <img className="h-8 w-8" src="/logo.png" alt="Workflow Logo" />
              <span className="text-xl font-bold text-gray-900 tracking-tight">
                Workflow
              </span>
            </div>

            <nav className="hidden sm:flex space-x-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
                    ${activeTab === item.id 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                  `}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="relative ml-3">
            {user && (
              <div>
                <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`flex items-center gap-3 max-w-xs p-1 pr-3  bg-white transition-colors duration-200 ease-in-out ${
                    isDropdownOpen
                    ? 'bg-gray-300 border-gray-300 text-gray-800'
                    : 'bg-white hover:bg-gray-100 hover:border-gray-200'
                    }`}
                >
                  <img
                    className="h-8 w-8 rounded-full object-cover border border-gray-200"
                    src={profileSrc}
                    alt={user.displayName || 'User avatar'}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== fallbackAvatar) target.src = fallbackAvatar;
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700 hidden md:block">
                    {user.displayName}
                  </span>
                </button>

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10 cursor-default" 
                      onClick={() => setIsDropdownOpen(false)}
                    ></div>

                    <div className="select-none origin-top-right absolute right-0 mt-1 w-41 rounded-sm py-2 bg-white ring-2 ring-black ring-opacity-5 z-20">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          logout();
                        }}
                        className="w-full text-left block px-4 py-2 text-sm text-red-500 hover:bg-gray-50"
                      >
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;