import { useCallback, useEffect, useState } from "react";

const KEY = "workPrefs";
const EVENT = "workprefschange";

export const DEFAULT_PREFS = {
  colors: false,
  table: false,
  showPast: false,
  neuralCapture: false,
  calendarView: "month",
  plannerView: "day",
};

const CALENDAR_VIEWS = ["month", "week"];
const PLANNER_VIEWS = ["day", "week"];
const CHOICES = { calendarView: CALENDAR_VIEWS, plannerView: PLANNER_VIEWS };

export function readPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || typeof saved !== "object") return { ...DEFAULT_PREFS };
    return {
      colors: !!saved.colors,
      table: !!saved.table,
      showPast: !!saved.showPast,
      neuralCapture: !!saved.neuralCapture,
      calendarView: CALENDAR_VIEWS.includes(saved.calendarView)
        ? saved.calendarView
        : DEFAULT_PREFS.calendarView,
      plannerView: PLANNER_VIEWS.includes(saved.plannerView)
        ? saved.plannerView
        : DEFAULT_PREFS.plannerView,
    };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
}

export function useWorkPrefs() {
  const [prefs, setPrefs] = useState(readPrefs);

  useEffect(() => {
    const sync = () => setPrefs(readPrefs());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setPref = useCallback((key, value) => {
    const next = {
      ...readPrefs(),
      [key]: CHOICES[key] ? value : !!value,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [prefs, setPref];
}
