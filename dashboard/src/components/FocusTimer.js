import React, { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
import { dbRef, onValueRef, updateData } from '../firebaseHelpers';

const FocusTimer = ({ user }) => {
  const [time, setTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work');
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  
  const [stats, setStats] = useState({ work: 0, break: 0 });

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const audioRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    
    const rect = e.target.getBoundingClientRect();
    const isResizeHandle = e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20;
    if (isResizeHandle) return;

    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    if (!user) return;
    
    if (Notification && Notification.permission !== "granted") {
      if (Notification.requestPermission) Notification.requestPermission();
    }

    const timerRef = dbRef(`users/${user.uid}/timer`);
    const handleSnapshot = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (!isRunning) {
            setTime(data.timeRemaining || (data.mode === 'work' ? workDuration * 60 : breakDuration * 60));
            setMode(data.mode || 'work');
        }
        if (data.stats) {
            setStats({
                work: data.stats.work || 0,
                break: data.stats.break || 0
            });
        }
      }
    };
    const unsubscribe = onValueRef(timerRef, handleSnapshot);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user, isRunning, workDuration, breakDuration]);

  useEffect(() => {
    let interval = null;

    if (isRunning && time > 0) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1);
        setStats(prevStats => ({
            ...prevStats,
            [mode]: prevStats[mode] + 1
        }));
      }, 1000);
    } else if (time === 0) {
      handleTimerComplete();
    }

    return () => clearInterval(interval);
  }, [isRunning, time, mode]);

  const updateDb = (newMode, newTime, newStats) => {
      if (!user) return;
      updateData(dbRef(`users/${user.uid}/timer`), {
        mode: newMode !== undefined ? newMode : mode,
        timeRemaining: newTime !== undefined ? newTime : time,
        stats: newStats || stats
      });
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    
    try {
      const playResult = audioRef.current && audioRef.current.play && audioRef.current.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {});
      }
    } catch (e) {}

    if (Notification && Notification.permission === "granted" && typeof Notification === 'function') {
      try {
        new Notification(mode === 'work' ? "Great job!" : "Break over!", {
          body: mode === 'work' ? "Time to take a break." : "Time to get back to work.",
          icon: "/logo.png"
        });
      } catch (e) {}
    }

    const newMode = mode === 'work' ? 'break' : 'work';
    const newTime = newMode === 'work' ? workDuration * 60 : breakDuration * 60;
    
    setMode(newMode);
    setTime(newTime);
    updateDb(newMode, newTime, stats);
  };

  const toggleTimer = (e) => {
    e.stopPropagation();
    if (isRunning) {
        updateDb(mode, time, stats);
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = (e) => {
    e.stopPropagation();
    setIsRunning(false);
    const resetTime = mode === 'work' ? workDuration * 60 : breakDuration * 60;
    setTime(resetTime);
    updateDb(mode, resetTime, stats);
  };

  const saveSettings = () => {
    setShowSettings(false);
    setIsRunning(false);
    setMode('work');
    setTime(workDuration * 60);
    updateDb('work', workDuration * 60, stats);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatStats = (totalSeconds) => {
      const hrs = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      return `${hrs}h ${mins}m`;
  };

  return (
    <div 
      className="absolute bg-white shadow-2xl rounded-2xl border border-neutral-200 cursor-move select-none overflow-hidden resize-both"
      onMouseDown={handleMouseDown}
      style={{ 
        left: '50%',
        top: '50%',
        width: '500px',
        height: '400px',
        minWidth: '320px',
        minHeight: '300px',
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
      }}
    >
        <div className="relative w-full h-full flex flex-col">
            <div className="absolute top-4 right-4 z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                  className="text-neutral-300 hover:text-neutral-500 transition-colors p-2 hover:bg-neutral-50"
                  aria-label={showSettings ? "Close settings M10.325" : "Open settings M10.325"}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 pointer-events-none">
                <div className="pointer-events-auto text-center">
                    <span className={`inline-block px-3 py-1 text-sm font-medium mb-6 ${
                        mode === 'work' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                    }`}>
                        {mode === 'work' ? 'get back to work!' : 'be chill'}
                    </span>
                    
                    <div className="text-7xl font-light text-neutral-800 tabular-nums tracking-tight mb-8">
                        {formatTime(time)}
                    </div>

                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={toggleTimer} 
                            className={`px-8 py-3 rounded-lg text-white font-medium transition-colors shadow-sm ${
                                isRunning ? 'bg-amber-300 hover:bg-amber-400' : 'bg-blue-300 hover:bg-blue-400'
                            }`}
                        >
                            {isRunning ? 'Pause' : 'Start'}
                        </button>
                        <button 
                            onClick={resetTimer} 
                            className="px-8 py-3 rounded-lg bg-white border border-neutral-200 text-neutral-600 font-medium hover:bg-neutral-50 transition-colors"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {showSettings && (
                <div 
                    className="absolute inset-0 bg-white/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 cursor-default"
                    onMouseDown={(e) => e.stopPropagation()}
                >

                    <div className="grid grid-cols-2 gap-4 w-full mb-6 max-w-sm">
                        <div className=" p-4 rounded-lg text-center">
                            <div className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Study Time</div>
                            <div className="text-xl font-bold text-blue-700">{formatStats(stats.work)}</div>
                        </div>
                        <div className=" p-4 rounded-lg text-center">
                            <div className="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">Play Time</div>
                            <div className="text-xl font-bold text-green-700">{formatStats(stats.break)}</div>
                        </div>
                    </div>
                    
                    <div className="w-full max-w-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Work (min)</label>
                                <input 
                                  aria-label="Work (min)"
                                  type="number" 
                                  value={workDuration}
                                  onChange={(e) => setWorkDuration(Number(e.target.value))}
                                  className="w-full border border-neutral-200 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Break (min)</label>
                                <input 
                                  aria-label="Break (min)"
                                  type="number" 
                                  value={breakDuration}
                                  onChange={(e) => setBreakDuration(Number(e.target.value))}
                                  className="w-full border border-neutral-200 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={saveSettings}
                                className="flex-1 bg-blue-300 text-white py-2 rounded text-sm hover:bg-blue-400 font-medium"
                            >
                                Save
                            </button>
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="flex-1 bg-neutral-100 text-neutral-600 py-2 rounded text-sm hover:bg-neutral-200 font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default FocusTimer;