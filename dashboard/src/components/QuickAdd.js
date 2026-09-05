import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  parseQuick,
  matchSpaces,
  activeToken,
  replaceToken,
} from "../lib/quickParse";
import {
  WORK_TYPES,
  NEUTRAL_CHIP,
  colorOf,
  formatWhen,
  priorityOf,
  typeLabel,
} from "../constants/work";
import { useWorkPrefs } from "../lib/workPrefs";

// Only the parts worth teaching. Times, locations and bare-word matching all
// still parse — they just don't need a legend.
const HINT = "#class   /type   !!!   fri";

const QuickAdd = ({ spaces, onSubmit, defaultDate = "", placeholder }) => {
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);
  const pendingCaret = useRef(null);
  const [prefs] = useWorkPrefs();

  const parsed = useMemo(
    () => parseQuick(text, { spaces }),
    [text, spaces]
  );

  const token = useMemo(() => activeToken(text, caret), [text, caret]);

  const suggestions = useMemo(() => {
    if (!token) return [];
    if (token.sigil === "#") {
      const matches = token.query
        ? matchSpaces(token.query, spaces)
        : spaces.slice(0, 6);
      const items = matches
        .slice(0, 6)
        .map((space) => ({ key: space.id, label: space.name, space }));
      if (token.query && !matches.some((s) => s.name.toLowerCase() === token.query.toLowerCase())) {
        items.push({
          key: "__new__",
          label: `Create "${token.query}"`,
          value: token.query,
          isNew: true,
        });
      }
      return items;
    }
    const query = token.query.toLowerCase();
    return WORK_TYPES.filter((type) => type.id.startsWith(query))
      .slice(0, 6)
      .map((type) => ({ key: type.id, label: type.label, value: type.id }));
  }, [token, spaces]);

  useEffect(() => setHighlight(0), [text, caret]);

  // Caret placement after an autocomplete has to wait for the re-render.
  useEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(
      pendingCaret.current,
      pendingCaret.current
    );
    setCaret(pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

  const syncCaret = (event) => setCaret(event.target.selectionStart || 0);

  const applySuggestion = (suggestion) => {
    if (!token) return;
    const value = suggestion.space ? suggestion.space.name : suggestion.value;
    const next = replaceToken(text, token, value);
    setText(next.text);
    pendingCaret.current = next.caret;
    inputRef.current?.focus();
  };

  const commit = () => {
    if (!parsed.filled.title && !parsed.title) return;
    // On the calendar the selected day is the obvious default, but anything
    // the line said explicitly still wins.
    onSubmit(
      defaultDate && !parsed.filled.date
        ? { ...parsed, date: defaultDate }
        : parsed
    );
    setText("");
    setCaret(0);
  };

  const handleKeyDown = (event) => {
    if (suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((h) => (h + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        applySuggestion(suggestions.at(highlight));
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCaret(-1); // closes the dropdown until the caret moves again
        return;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

  const space =
    spaces.find((item) => item.id === parsed.spaceId) ||
    (parsed.newSpaceName
      ? { name: parsed.newSpaceName, color: "slate", isNew: true }
      : null);
  const spaceColor = colorOf(space?.color);
  const priority = priorityOf(parsed.priority);

  const chip = "text-[11px] px-2 py-0.5 rounded-full";
  const idle = NEUTRAL_CHIP;

  const hasChips =
    !!space ||
    parsed.filled.type ||
    parsed.filled.priority ||
    parsed.filled.date ||
    parsed.mode === "event" ||
    !!parsed.location;

  return (
    <div className="relative">
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart || 0);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onFocus={() => setShowHint(true)}
          onBlur={() => {
            setShowHint(false);
            setCaret(-1);
          }}
          placeholder={placeholder || "Multi WS2 #multi /hw fri"}
          className="flex-grow border border-border rounded-md px-4 py-2 text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Quick add"
        />
        <button
          onClick={commit}
          disabled={!parsed.title}
          className="bg-primary text-primary-foreground px-5 py-2 rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-sm"
        >
          Add
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 w-64 max-w-full bg-card border border-border rounded-md shadow-lg py-1">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.key}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySuggestion(suggestion);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                  index === highlight
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {suggestion.space && (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      colorOf(suggestion.space.color).dot
                    }`}
                  />
                )}
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Only what the line actually set — defaults stay invisible. */}
      {hasChips && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {space && (
            <span className={`${chip} ${prefs.colors ? spaceColor.chip : idle}`}>
              {space.isNew ? `+ ${space.name}` : space.name}
            </span>
          )}
          {parsed.filled.type && (
            <span className={`${chip} ${idle}`}>{typeLabel(parsed.type)}</span>
          )}
          {parsed.filled.priority && (
            <span className={`${chip} ${priority.chip}`}>{priority.label}</span>
          )}
          {parsed.filled.date && (
            <span className={`${chip} ${idle}`}>
              {formatWhen({ when: { ...parsed, mode: parsed.mode } })}
            </span>
          )}
          {parsed.mode === "event" && (
            <span className={`${chip} ${idle}`}>Event</span>
          )}
          {parsed.location && (
            <span className={`${chip} ${idle}`}>@ {parsed.location}</span>
          )}
        </div>
      )}

      {showHint && text.trim() === "" && (
        <p className="text-xs text-muted-foreground mt-2">{HINT}</p>
      )}
    </div>
  );
};

export default QuickAdd;
