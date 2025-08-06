import React, { useState, useEffect } from 'react';

const HabitTracker = () => {
  const habits = ['Workout', 'Read', 'Relax', 'Commit'];
  const [habitData, setHabitData] = useState({});

  useEffect(() => {
    const loadedHabitData = JSON.parse(localStorage.getItem('habits')) || {};
    setHabitData(loadedHabitData);
  }, []);

  const handleHabitChange = (habitIndex, dayIndex, checked) => {
    const newHabitData = { ...habitData };
    if (!newHabitData[habitIndex]) {
      newHabitData[habitIndex] = {};
    }
    newHabitData[habitIndex][dayIndex] = checked;
    setHabitData(newHabitData);
    localStorage.setItem('habits', JSON.stringify(newHabitData));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">habit Tracker</h2>
      <div className="habit-day-labels grid grid-cols-[1fr_repeat(7,_40px)] gap-2 p-2 font-bold text-center mb-1">
        <div className="habit-name text-left">Habit</div>
        <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
      </div>
      <div className="habit-tracker-grid grid gap-4">
        {habits.map((habit, habitIndex) => (
          <div key={habitIndex} className="habit-row grid grid-cols-[1fr_repeat(7,_40px)] items-center gap-2 p-2 bg-gray-100 rounded">
            <div className="habit-name font-medium">{habit}</div>
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <input 
                key={dayIndex} 
                type="checkbox" 
                className="h-6 w-6 justify-self-center"
                checked={habitData[habitIndex]?.[dayIndex] || false}
                onChange={(e) => handleHabitChange(habitIndex, dayIndex, e.target.checked)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HabitTracker;