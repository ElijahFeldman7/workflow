import React, { useState } from 'react';
import TaskManager from './components/TaskManager';
import KnowledgeBase from './components/KnowledgeBase';
import DailyScheduler from './components/DailyScheduler';
import FocusTimer from './components/FocusTimer';
import HabitTracker from './components/HabitTracker';
import QuickLinks from './components/QuickLinks';
import {Link} from 'react-router-dom'

function App() {
  const [activeTab, setActiveTab] = useState('tasks');

  const navItems = [
    { id: 'tasks', label: 'Tasks', component: <TaskManager /> },
    { id: 'notes', label: 'Knowledge', component: <KnowledgeBase /> },
    { id: 'scheduler', label: 'Schedule', component: <DailyScheduler /> },
    { id: 'focus', label: 'Focus', component: <FocusTimer /> },
    { id: 'habits', label: 'Habits', component: <HabitTracker /> },
    { id: 'links', label: 'Links', component: <QuickLinks /> },
  ];

  const ActiveComponent = navItems.find(item => item.id === activeTab)?.component;

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold tracking-tight">
                <Link to="/">Workflow</Link>
              </span>
            </div>

            <div className="hidden sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`
                    inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors duration-200
                    ${activeTab === item.id 
                      ? 'border-blue-500 text-gray-900' 
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
                  `}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="-mr-2 flex items-center sm:hidden">
              <button className="text-gray-400 hover:text-gray-500 p-2">
                <span className="sr-only">Open menu</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
          </div>
        </div>
      </header>

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {ActiveComponent}
        </div>
      </main>

    </div>
  );
}

export default App;