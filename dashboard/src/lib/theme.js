import { useCallback, useEffect, useState } from "react";

const KEY = "palette";
const EVENT = "palettechange";

export const PALETTES = [
  { id: "original", label: "Original", swatch: "#2563eb" },
  { id: "catppuccin", label: "Catppuccin", swatch: "#8839ef" },
  { id: "navy", label: "Navy", swatch: "#ff6a00" },
  { id: "tokyo", label: "Tokyo Night", swatch: "#3d76e8" },
  { id: "matcha", label: "Matcha", swatch: "#5a8f47" },
];

export const DEFAULT_PALETTE = "original";

const isValid = (id) => PALETTES.some((palette) => palette.id === id);

export function readPalette() {
  try {
    const saved = localStorage.getItem(KEY);
    return isValid(saved) ? saved : DEFAULT_PALETTE;
  } catch (e) {
    return DEFAULT_PALETTE;
  }
}

export function applyPalette(id) {
  const root = document.documentElement;
  if (!isValid(id) || id === DEFAULT_PALETTE)
    root.removeAttribute("data-palette");
  else root.setAttribute("data-palette", id);
}

export function usePalette() {
  const [palette, setPaletteState] = useState(readPalette);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  useEffect(() => {
    const sync = () => setPaletteState(readPalette());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setPalette = useCallback((id) => {
    const next = isValid(id) ? id : DEFAULT_PALETTE;
    localStorage.setItem(KEY, next);
    applyPalette(next);
    setPaletteState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [palette, setPalette];
}
