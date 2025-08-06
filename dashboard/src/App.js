import React, { useState } from 'react';
import TaskManager from './components/TaskManager';
import KnowledgeBase from './components/KnowledgeBase';
import DailyScheduler from './components/DailyScheduler';
import FocusTimer from './components/FocusTimer';
import HabitTracker from './components/HabitTracker';
import QuickLinks from './components/QuickLinks';

function App() {
  const [activeTab, setActiveTab] = useState('tasks');

  const tabs = {
    tasks: <TaskManager />,
    notes: <KnowledgeBase />,
    scheduler: <DailyScheduler />,
    focus: <FocusTimer />,
    habits: <HabitTracker />,
    links: <QuickLinks />,
  };

  return (
    <div className="bg-gray-100 min-h-screen flex justify-center items-start p-4">
      <div className="dashboard-container w-full max-w-6xl bg-white rounded-lg shadow-lg overflow-hidden flex flex-col">
        <nav className="tabs-nav flex bg-gray-50 border-b border-gray-200 px-4">
          <button className={`tab-button px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-blue-500 ${activeTab === 'tasks' ? 'text-blue-500 border-blue-500' : ''}`} onClick={() => setActiveTab('tasks')}>task Manager</button>
          <button className={`tab-button px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-blue-500 ${activeTab === 'notes' ? 'text-blue-500 border-blue-500' : ''}`} onClick={() => setActiveTab('notes')}>knowledge Base</button>
          <button className={`tab-button px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-blue-500 ${activeTab === 'scheduler' ? 'text-blue-500 border-blue-500' : ''}`} onClick={() => setActiveTab('scheduler')}>daily Scheduler</button>
          <button className={`tab-button px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-blue-500 ${activeTab === 'focus' ? 'text-blue-500 border-blue-500' : ''}`} onClick={() => setActiveTab('focus')}>focus Timer</button>
          <button className={`tab-button px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-blue-500 ${activeTab === 'habits' ? 'text-blue-500 border-blue-500' : ''}`} onClick={() => setActiveTab('habits')}>habit Tracker</button>
          <button className={`tab-button px-4 py-3 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-blue-500 ${activeTab === 'links' ? 'text-blue-500 border-blue-500' : ''}`} onClick={() => setActiveTab('links')}>quick Links</button>
        </nav>
        <main className="tabs-content p-6 min-h-[60vh]">
          {tabs[activeTab]}
        </main>
      </div>
    </div>
  );
}

export default App;