import { useCallback, useEffect, useState } from "react";

const KEY = "workPrefs";
const EVENT = "workprefschange";

export const DEFAULT_PREFS = {
  colors: false,
  table: false,
  showPast: false,
  calendarView: "month",
};

const CALENDAR_VIEWS = ["month", "week"];

export function readPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || typeof saved !== "object") return { ...DEFAULT_PREFS };
    return {
      colors: !!saved.colors,
      table: !!saved.table,
      showPast: !!saved.showPast,
      calendarView: CALENDAR_VIEWS.includes(saved.calendarView)
        ? saved.calendarView
        : DEFAULT_PREFS.calendarView,
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
      [key]: key === "calendarView" ? value : !!value,
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [prefs, setPref];
}
