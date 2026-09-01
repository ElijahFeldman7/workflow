import { useCallback, useEffect, useState } from "react";

// View preferences for the Work tab. Local to the device, like the other
// settings in this app. Settings and Work live on different tabs, so a custom
// event keeps them in sync without a provider.

const KEY = "workPrefs";
const EVENT = "workprefschange";

export const DEFAULT_PREFS = {
  colors: false, // colored dots and tags
  table: false, // Notion-style table instead of the grouped list
};

export function readPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || typeof saved !== "object") return { ...DEFAULT_PREFS };
    return {
      colors: !!saved.colors,
      table: !!saved.table,
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
    const next = { ...readPrefs(), [key]: !!value };
    localStorage.setItem(KEY, JSON.stringify(next));
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [prefs, setPref];
}
