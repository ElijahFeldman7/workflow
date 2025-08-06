import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, set } from "firebase/database";

const FocusTimer = () => {
  const [time, setTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isWorkTime, setIsWorkTime] = useState(true);

  useEffect(() => {
    const timerRef = ref(database, 'timer');
    onValue(timerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTime(data.time);
        setIsWorkTime(data.isWorkTime);
      }
    });
  }, []);

  useEffect(() => {
    let timer;
    if (isRunning) {
      timer = setInterval(() => {
        setTime(prevTime => {
          if (prevTime <= 0) {
            clearInterval(timer);
            setIsRunning(false);
            alert(isWorkTime ? "Time for a break!" : "Time to get back to work!");
            const newIsWorkTime = !isWorkTime;
            const newTime = newIsWorkTime ? 25 * 60 : 5 * 60;
            setIsWorkTime(newIsWorkTime);
            set(ref(database, 'timer'), { time: newTime, isWorkTime: newIsWorkTime });
            return newTime;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, isWorkTime]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const startTimer = () => setIsRunning(true);
  const stopTimer = () => setIsRunning(false);
  const resetTimer = () => {
    setIsRunning(false);
    setIsWorkTime(true);
    const newTime = 25 * 60;
    setTime(newTime);
    set(ref(database, 'timer'), { time: newTime, isWorkTime: true });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Focus Timer</h2>
      <div className="timer-container text-center">
        <div className="text-xl font-bold mb-4 text-blue-500">{isWorkTime ? 'get back to Work!' : 'Time for a Break!'}</div>
        <div className="text-7xl font-light my-4">{formatTime(time)}</div>
        <div className="timer-controls">
          <button onClick={startTimer} className="bg-blue-500 text-white px-4 py-2 rounded mx-2 w-24">Start</button>
          <button onClick={stopTimer} className="bg-blue-500 text-white px-4 py-2 rounded mx-2 w-24">Stop</button>
          <button onClick={resetTimer} className="bg-blue-500 text-white px-4 py-2 rounded mx-2 w-24">Reset</button>
        </div>
      </div>
    </div>
  );
};

export default FocusTimer;