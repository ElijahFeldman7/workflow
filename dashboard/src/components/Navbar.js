import React, { useState } from "react";
import { logout } from "../firebase";
import { useDarkMode } from "../context/DarkModeContext";

const Navbar = ({
  activeTab,
  setActiveTab,
  navItems,
  user,
  onOpenSettings,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const fallbackAvatar =
    typeof user?.displayName === "string"
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
          user.displayName
        )}`
      : "https://ui-avatars.com/api/?name=User";

  const profileSrc =
    user?.photoURL ||
    (user?.providerData &&
      user.providerData[0] &&
      user.providerData[0].photoURL) ||
    fallbackAvatar;

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-6">
            <div
              className="flex-shrink-0 flex items-center cursor-pointer gap-3"
              onClick={() => setActiveTab("tasks")}
            >
              <img className="h-8 w-8" src="/logo.png" alt="Workflow Logo" />
              <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
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
                    ${
                      activeTab === item.id
                        ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
                    }
                  `}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDarkMode ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>

            <div className="relative ml-3">
              {user && (
                <div>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`flex items-center gap-3 max-w-xs p-1 pr-3 rounded-lg transition-colors duration-200 ease-in-out ${
                      isDropdownOpen
                        ? "bg-gray-200 dark:bg-gray-700"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <img
                      className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                      src={profileSrc}
                      alt={user.displayName || "User avatar"}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== fallbackAvatar)
                          target.src = fallbackAvatar;
                      }}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">
                      {user.displayName}
                    </span>
                  </button>

                  {isDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setIsDropdownOpen(false)}
                      ></div>

                      <div className="select-none origin-top-right absolute right-0 mt-1 w-48 rounded-md py-2 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 shadow-lg z-20">
                        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Signed in as
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.email}
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            onOpenSettings();
                          }}
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <span className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            Settings
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsDropdownOpen(false);
                            logout();
                          }}
                          className="w-full text-left block px-4 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700"
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
      </div>
    </header>
  );
};

export default Navbar;
