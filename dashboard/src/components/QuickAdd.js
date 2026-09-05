import React, { useMemo, useRef, useState, useEffect } from "react";
import { matchSpaces, activeToken, replaceToken } from "../lib/quickParse";
import { WORK_TYPES, colorOf } from "../constants/work";
import { useWorkPrefs } from "../lib/workPrefs";
import { useCapture } from "../lib/useCapture";
import CapturePreview from "./CapturePreview";

const HINT = "#class   /type   !!!   fri";

const QuickAdd = ({
  spaces,
  onSubmit,
  defaultDate = "",
  placeholder,
  memory = null,
  onLearn,
}) => {
  const [text, setText] = useState("");
  const [overrides, setOverrides] = useState({});
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef(null);
  const pendingCaret = useRef(null);
  const [prefs] = useWorkPrefs();

  const { parsed: captured } = useCapture(text, {
    spaces,
    memory,
    neural: prefs.neuralCapture,
  });

  const parsed = useMemo(() => {
    if (Object.keys(overrides).length === 0) return captured;
    const next = { ...captured, filled: { ...captured.filled } };

    if (overrides.space !== undefined) {
      next.spaceId = overrides.space;
      next.newSpaceName = "";
      next.filled.space = overrides.space !== "";
    }
    if (overrides.type !== undefined) {
      next.type = overrides.type;
      next.filled.type = overrides.type !== "";
    }
    if (overrides.priority !== undefined) next.priority = overrides.priority;
    if (overrides.mode !== undefined) next.mode = overrides.mode;

    return next;
  }, [captured, overrides]);

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

  const correct = (field, value) => {
    setOverrides((current) => ({ ...current, [field]: value }));
    const phrase = (captured.phrases && captured.phrases[field]) || captured.title;
    if (onLearn && phrase && value) onLearn(phrase, field, value);
  };

  const commit = () => {
    if (!parsed.filled.title && !parsed.title) return;
    onSubmit(
      defaultDate && !parsed.filled.date
        ? { ...parsed, date: defaultDate }
        : parsed
    );
    setText("");
    setCaret(0);
    setOverrides({});
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
        setCaret(-1);
        return;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  };

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

      <CapturePreview
        parsed={parsed}
        spaces={spaces}
        colors={prefs.colors}
        onCorrect={correct}
      />

      {showHint && text.trim() === "" && (
        <p className="text-xs text-muted-foreground mt-2">{HINT}</p>
      )}
    </div>
  );
};

export default QuickAdd;
