import React, { useState, useEffect, useRef, useCallback } from "react";
import { dbRef, onValueRef, updateData } from "../firebaseHelpers";
import {
  durationOf,
  emptyTimer,
  foldTimer,
  normalizeTimer,
  remainingOf,
  statsOf,
} from "../lib/timerState";

const TICK_MS = 500;
const AUTOSAVE_MS = 20 * 1000;

const FocusTimer = ({ user }) => {
  const [state, setState] = useState(emptyTimer);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState({ work: state.workDuration, break: state.breakDuration });
  const [, setTick] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const completing = useRef(false);

  const audioRef = useRef(null);
  if (audioRef.current === null) {
    try {
      audioRef.current = new Audio(
        "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
      );
    } catch (e) {
      audioRef.current = undefined;
    }
  }

  const persist = useCallback(
    (next) => {
      if (!user) return;
      const reference = dbRef(`users/${user.uid}/timer`);
      if (!reference) return;
      updateData(reference, {
        mode: next.mode,
        remaining: next.remaining,
        running: next.running,
        startedAt: next.startedAt,
        workDuration: next.workDuration,
        breakDuration: next.breakDuration,
        stats: next.stats,
        position: next.position,
        updatedAt: next.updatedAt,
      });
    },
    [user]
  );

  // Every change banks the time already run, then writes the whole truth.
  const apply = useCallback(
    (changes) => {
      const at = Date.now();
      const next = {
        ...foldTimer(stateRef.current, at),
        ...changes,
        updatedAt: at,
      };
      stateRef.current = next;
      setState(next);
      persist(next);
      return next;
    },
    [persist]
  );

  useEffect(() => {
    if (!user) {
      setState(emptyTimer());
      return undefined;
    }

    const reference = dbRef(`users/${user.uid}/timer`);
    if (!reference) return undefined;

    const unsubscribe = onValueRef(reference, (snapshot) => {
      const saved = normalizeTimer(snapshot && snapshot.val());
      // Ignore the echo of a write we already hold, and anything older than it.
      if (saved.updatedAt < stateRef.current.updatedAt) return;
      stateRef.current = saved;
      setState(saved);
      setDraft({ work: saved.workDuration, break: saved.breakDuration });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default" && Notification.requestPermission) {
      try {
        Notification.requestPermission();
      } catch (e) {
        /* older browsers reject the promise form */
      }
    }
  }, []);

  // The clock is derived from timestamps, so this only forces a repaint.
  useEffect(() => {
    if (!state.running) return undefined;
    const interval = setInterval(() => setTick((value) => value + 1), TICK_MS);
    return () => clearInterval(interval);
  }, [state.running]);

  // Keep a running session durable even if the tab never gets closed cleanly.
  useEffect(() => {
    if (!state.running || !user) return undefined;
    const interval = setInterval(() => apply({}), AUTOSAVE_MS);
    return () => clearInterval(interval);
  }, [state.running, user, apply]);

  useEffect(() => {
    if (!user) return undefined;
    const save = () => {
      if (stateRef.current.running) apply({});
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
      save();
    };
  }, [user, apply]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      setState((prev) => ({
        ...prev,
        position: {
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        },
      }));
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      apply({ position: stateRef.current.position });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [apply]);

  const handleMouseDown = (e) => {
    if (
      e.target.tagName === "BUTTON" ||
      e.target.tagName === "INPUT" ||
      e.target.closest("button")
    )
      return;

    const rect = e.target.getBoundingClientRect();
    const isResizeHandle =
      e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20;
    if (isResizeHandle) return;

    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - state.position.x,
      y: e.clientY - state.position.y,
    };
  };

  const handleTimerComplete = useCallback(() => {
    try {
      const playResult =
        audioRef.current && audioRef.current.play && audioRef.current.play();
      if (playResult && typeof playResult.catch === "function")
        playResult.catch(() => {});
    } catch (e) {
      /* autoplay policy */
    }

    const finished = stateRef.current.mode;
    if (
      typeof Notification === "function" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(finished === "work" ? "Great job!" : "Break over!", {
          body:
            finished === "work"
              ? "Time to take a break."
              : "Time to get back to work.",
          icon: "/logo.png",
        });
      } catch (e) {
        /* notification constructor can throw on mobile */
      }
    }

    const nextMode = finished === "work" ? "break" : "work";
    apply({
      mode: nextMode,
      remaining: durationOf(stateRef.current, nextMode),
      running: false,
      startedAt: 0,
    });
  }, [apply]);

  const remaining = remainingOf(state);
  const stats = statsOf(state);

  useEffect(() => {
    if (!state.running || remaining > 0) {
      completing.current = false;
      return;
    }
    if (completing.current) return;
    completing.current = true;
    handleTimerComplete();
  }, [state.running, remaining, handleTimerComplete]);

  const toggleTimer = (e) => {
    e.stopPropagation();
    if (state.running) {
      apply({ running: false, startedAt: 0 });
      return;
    }
    // Starting from a spent clock rolls it back to a full interval.
    const current = stateRef.current;
    const changes = { running: true, startedAt: Date.now() };
    if (current.remaining <= 0) changes.remaining = durationOf(current);
    apply(changes);
  };

  const resetTimer = (e) => {
    e.stopPropagation();
    apply({
      running: false,
      startedAt: 0,
      remaining: durationOf(stateRef.current),
    });
  };

  const saveSettings = () => {
    setShowSettings(false);
    const workDuration = Math.max(1, Math.round(draft.work) || 1);
    const breakDuration = Math.max(1, Math.round(draft.break) || 1);
    apply({
      workDuration,
      breakDuration,
      mode: "work",
      remaining: workDuration * 60,
      running: false,
      startedAt: 0,
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatStats = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const { mode, position } = state;
  const isRunning = state.running;
  const time = remaining;
  const workDuration = draft.work;
  const breakDuration = draft.break;
  const setWorkDuration = (value) => setDraft((prev) => ({ ...prev, work: value }));
  const setBreakDuration = (value) => setDraft((prev) => ({ ...prev, break: value }));

  return (
    <div
      className="absolute bg-card shadow-2xl rounded-2xl border border-border cursor-move select-none overflow-hidden resize-both transition-colors duration-200"
      onMouseDown={handleMouseDown}
      style={{
        left: "50%",
        top: "50%",
        width: "500px",
        height: "400px",
        minWidth: "320px",
        minHeight: "300px",
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        transition: isDragging.current ? "none" : "transform 0.1s ease-out",
      }}
    >
      <div className="relative w-full h-full flex flex-col">
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
            }}
            className="text-muted-foreground/60 hover:text-foreground transition-colors p-2 hover:bg-muted/60 rounded"
            aria-label={
              showSettings ? "Close settings M10.325" : "Open settings M10.325"
            }
          >
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
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 pointer-events-none">
          <div className="pointer-events-auto text-center">
            <span
              className={`inline-block px-3 py-1 text-sm font-medium mb-6 rounded ${
                mode === "work"
                  ? "bg-primary/15 text-primary"
                  : "bg-green-50 dark:bg-green-900/50 text-green-600 dark:text-green-400"
              }`}
            >
              {mode === "work" ? "get back to work!" : "be chill"}
            </span>

            <div className="text-7xl font-light text-foreground tabular-nums tracking-tight mb-8">
              {formatTime(time)}
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={toggleTimer}
                className={`px-8 py-3 rounded-lg text-primary-foreground font-medium transition-colors shadow-sm ${
                  isRunning
                    ? "bg-amber-300 hover:bg-amber-400 dark:bg-amber-500 dark:hover:bg-amber-400"
                    : "bg-primary hover:bg-primary/85"
                }`}
              >
                {isRunning ? "Pause" : "Start"}
              </button>
              <button
                onClick={resetTimer}
                className="px-8 py-3 rounded-lg bg-background border border-border text-foreground font-medium hover:bg-muted/60 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {showSettings && (
          <div
            className="absolute inset-0 bg-card/90 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-4 w-full mb-6 max-w-sm">
              <div className="p-4 rounded-lg text-center bg-primary/10">
                <div className="text-xs text-primary font-medium uppercase tracking-wider mb-1">
                  Study Time
                </div>
                <div className="text-xl font-bold text-primary">
                  {formatStats(stats.work)}
                </div>
              </div>
              <div className="p-4 rounded-lg text-center bg-green-50/50 dark:bg-green-900/30">
                <div className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wider mb-1">
                  Play Time
                </div>
                <div className="text-xl font-bold text-green-700 dark:text-green-300">
                  {formatStats(stats.break)}
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Work (min)
                  </label>
                  <input
                    aria-label="Work (min)"
                    type="number"
                    value={workDuration}
                    onChange={(e) => setWorkDuration(Number(e.target.value))}
                    className="w-full border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Break (min)
                  </label>
                  <input
                    aria-label="Break (min)"
                    type="number"
                    value={breakDuration}
                    onChange={(e) => setBreakDuration(Number(e.target.value))}
                    className="w-full border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none bg-background text-foreground"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveSettings}
                  className="flex-1 bg-primary text-primary-foreground py-2 rounded text-sm hover:bg-primary/85 font-medium"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-muted text-foreground py-2 rounded text-sm hover:bg-muted/70 font-medium"
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
