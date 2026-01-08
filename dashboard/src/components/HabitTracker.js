import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, update } from "firebase/database";

const HabitTracker = ({ user }) => {
  const [habits, setHabits] = useState(['Workout', 'Read', 'Relax']);
  const [history, setHistory] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  const [tempHabits, setTempHabits] = useState([]);

  const today = new Date();
  const currentDayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  
  const getWeekDates = () => {
    const curr = new Date();
    const first = curr.getDate() - curr.getDay() + 1;
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(curr.setDate(first + i));
      dates.push(day.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    if (!user) return;
    const habitsRef = ref(database, `users/${user.uid}/habitData`);
    
    const unsubscribe = onValue(habitsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.list) setHabits(data.list);
        if (data.history) setHistory(data.history);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const toggleHabit = (habitIndex, dateStr) => {
    if (!user || isEditing) return;
    
    const newHistory = { ...history };
    if (!newHistory[habitIndex]) newHistory[habitIndex] = {};
    
    if (newHistory[habitIndex][dateStr]) {
        delete newHistory[habitIndex][dateStr];
    } else {
        newHistory[habitIndex][dateStr] = true;
    }

    setHistory(newHistory);
    update(ref(database, `users/${user.uid}/habitData`), {
        history: newHistory
    });
  };


  const startEditing = () => {
    setTempHabits([...habits]);
    setIsEditing(true);
    setShowHeatmap(false);
  };

  const handleHabitNameChange = (index, value) => {
    const newTemp = [...tempHabits];
    newTemp[index] = value;
    setTempHabits(newTemp);
  };

  const deleteHabit = (index) => {
    const newTemp = tempHabits.filter((_, i) => i !== index);
    setTempHabits(newTemp);
  };

  const addNewHabitRow = () => {
    setTempHabits([...tempHabits, '']);
  };

  const saveChanges = () => {
    const cleanHabits = tempHabits.filter(h => h.trim() !== '');
    setHabits(cleanHabits);
    setIsEditing(false);
    
    if (user) {
        update(ref(database, `users/${user.uid}/habitData`), {
            list: cleanHabits
        });
    }
  };

  const cancelChanges = () => {
    setIsEditing(false);
    setTempHabits([]);
  };

  const generateYearDays = () => {
      const dates = [];
      const year = new Date().getFullYear();
      const d = new Date(year, 0, 1);
      
      while (d.getFullYear() === year) {
          dates.push(d.toISOString().split('T')[0]);
          d.setDate(d.getDate() + 1);
      }
      return dates;
  };
  const yearDays = generateYearDays();

  const displayHabits = isEditing ? tempHabits : habits;

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-4xl mx-auto relative">
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Habit Tracker</h2>
        <div className="flex gap-2">
            {!isEditing && (
                <>
                    <button 
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        className={`p-2 rounded-full transition-colors ${showHeatmap ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                        title="Yearly View"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </button>
                    <button 
                        onClick={startEditing}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="Edit Habits"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_repeat(7,_1fr)] gap-2 mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider self-end pb-1 pl-2">
            {isEditing ? 'Editing Mode' : 'Habit'}
        </div>
        {days.map((day, i) => (
            <div key={day} className="flex flex-col items-center gap-1 h-8 justify-end">
                {i === currentDayIndex && (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mb-0.5"></div>
                )}
                <div className={`text-sm font-medium ${i === currentDayIndex ? 'text-gray-900' : 'text-gray-500'}`}>
                    {day}
                </div>
            </div>
        ))}
      </div>

      <div className="space-y-1">
        {displayHabits.map((habit, hIndex) => (
          <div key={hIndex} className="grid grid-cols-[1.5fr_repeat(7,_1fr)] gap-2 items-center p-2 rounded-lg">
            
            <div className="pr-2">
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => deleteHabit(hIndex)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <input
                            type="text"
                            value={habit}
                            onChange={(e) => handleHabitNameChange(hIndex, e.target.value)}
                            className="w-full text-sm border-b border-gray-300 focus:border-blue-500 outline-none py-1 bg-transparent"
                            placeholder="Habit name..."
                            autoFocus={isEditing && habit === ''}
                        />
                    </div>
                ) : (
                    <div className="font-medium text-gray-700 truncate pl-2">{habit}</div>
                )}
            </div>

            {weekDates.map((dateStr, dIndex) => {
                const isChecked = history[hIndex]?.[dateStr] || false;
                
                return (
                    <div key={dateStr} className="flex justify-center">
                        <button
                            onClick={() => toggleHabit(hIndex, dateStr)}
                            disabled={isEditing}
                            className={`
                                w-8 h-8 rounded-md flex items-center justify-center transition-all duration-200
                                ${isChecked 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 text-transparent hover:bg-gray-200'}
                                ${isEditing ? 'opacity-30 cursor-not-allowed' : ''}
                            `}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </button>
                    </div>
                );
            })}
          </div>
        ))}

        {isEditing && (
            <div className="pt-4 border-t border-gray-100 mt-4">
                <button 
                    onClick={addNewHabitRow}
                    className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 mb-4 pl-2"
                >
                    + Add Habit
                </button>
                
                <div className="flex gap-3">
                    <button 
                        onClick={saveChanges}
                        className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 font-medium text-sm transition-colors"
                    >
                        Save
                    </button>
                    <button 
                        onClick={cancelChanges}
                        className="bg-gray-100 text-gray-600 px-6 py-2 rounded-md hover:bg-gray-200 font-medium text-sm transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )}

        {!isEditing && habits.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
                No habits yet. Click the cog to add some!
            </div>
        )}
      </div>

      {showHeatmap && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col p-6 rounded-lg overflow-hidden">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Yearly Progress</h3>
                <button onClick={() => setShowHeatmap(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {habits.map((habit, hIndex) => (
                    <div key={hIndex}>
                        <div className="text-sm font-semibold text-gray-700 mb-2">{habit}</div>
                        <div className="flex flex-wrap gap-1">
                            {yearDays.map(dateStr => (
                                <div 
                                    key={dateStr}
                                    title={dateStr}
                                    className={`w-2.5 h-2.5 rounded-sm ${history[hIndex]?.[dateStr] ? 'bg-green-500' : 'bg-gray-100'}`}
                                ></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </div>
      )}
    </div>
  );
};

export default HabitTracker;