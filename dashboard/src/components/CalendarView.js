import React, { useState, useMemo, useEffect } from "react";
import QuickAdd from "./QuickAdd";
import WorkList from "./WorkList";
import WeekGrid from "./WeekGrid";
import { DayChip } from "./InlineFields";
import { useWorkData } from "../lib/useWorkData";
import { useWorkWrites } from "../lib/useWorkWrites";
import { useWorkPrefs } from "../lib/workPrefs";
import { migrateSchedule } from "../lib/migrateSchedule";
import {
  WEEKDAY_LABELS,
  monthMatrix,
  monthLabel,
  addMonths,
  weekMatrix,
  weekLabel,
  shiftWeek,
  longDayLabel,
  byDate,
} from "../lib/calendar";
import {
  NEUTRAL_CHIP,
  colorOf,
  formatTime,
  fromDateKey,
  priorityOf,
  toDateKey,
  todayKey,
} from "../constants/work";

const CHIPS_PER_CELL = 3;

const CalendarView = ({ user }) => {
  const { activeSpaces, spaceById, items, isLoading, error, setError } =
    useWorkData(user);
  const [prefs, setPref] = useWorkPrefs();
  const { patch, isDone, toggleDone, deleteItem, addItem } = useWorkWrites(
    user,
    activeSpaces,
    setError
  );

  const today = todayKey();
  // One anchor drives both views, so switching keeps you where you were.
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [expandedId, setExpandedId] = useState(null);
  const [migrated, setMigrated] = useState(0);

  const isWeek = prefs.calendarView === "week";

  // One-shot move of the old free-text hour slots into real events. Leaves
  // schedule/ in place, so this is safe to have run automatically.
  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    migrateSchedule(user)
      .then((result) => {
        if (alive && result.status === "done" && result.created > 0) {
          setMigrated(result.created);
        }
      })
      .catch(() => {
        /* the calendar still works without it */
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const anchorDate = useMemo(() => fromDateKey(anchor), [anchor]);
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const weekDays = useMemo(() => weekMatrix(anchor), [anchor]);
  const itemsByDate = useMemo(() => byDate(items), [items]);

  const selectedItems = itemsByDate.get(selected) || [];

  // The day panel renders through the same list as the Work tab, so it picks
  // up the table setting, the colors setting, and inline editing.
  const dayGroups = useMemo(
    () => [{ id: "day", label: "", tone: "", items: selectedItems }],
    [selectedItems]
  );

  const step = (delta) => {
    if (isWeek) {
      setAnchor((prev) => shiftWeek(prev, delta));
      return;
    }
    setAnchor((prev) => {
      const date = fromDateKey(prev);
      const next = addMonths(date.getFullYear(), date.getMonth(), delta);
      // Anchor on the 1st so stepping from the 31st can't skip a month.
      return toDateKey(new Date(next.year, next.month, 1));
    });
  };

  const goToToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  const pickDay = (key) => {
    setSelected(key);
    setAnchor(key);
  };

  const onToday = isWeek
    ? weekDays.some((day) => day.key === today)
    : year === fromDateKey(today).getFullYear() &&
      month === fromDateKey(today).getMonth();

  const chipClass = (item) => {
    const space = spaceById.get(item.spaceId);
    if (isDone(item)) return "bg-muted text-muted-foreground line-through";
    if (space && prefs.colors) return colorOf(space.color).chip;
    if (item.priority === "insane") return priorityOf("insane").chip;
    return NEUTRAL_CHIP;
  };

  // Unfinished deadlines that have already passed, so a busy month still
  // flags what's slipping.
  const overdueByDate = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (item.done || item.when.mode !== "due" || !item.when.date) return;
      if (item.when.date >= today) return;
      map.set(item.when.date, (map.get(item.when.date) || 0) + 1);
    });
    return map;
  }, [items, today]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="bg-card shadow rounded-md p-6 transition-colors duration-200">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => step(-1)}
              className="p-1.5 rounded text-muted-foreground hover:bg-muted/60 transition-colors"
              aria-label={isWeek ? "Previous week" : "Previous month"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold text-foreground truncate">
              {isWeek ? weekLabel(weekDays) : monthLabel(year, month)}
            </h2>
            <button
              onClick={() => step(1)}
              className="p-1.5 rounded text-muted-foreground hover:bg-muted/60 transition-colors"
              aria-label={isWeek ? "Next week" : "Next month"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!onToday && (
              <button
                onClick={goToToday}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
              >
                today
              </button>
            )}
            <div className="flex rounded overflow-hidden border border-border">
              {["month", "week"].map((view) => (
                <button
                  key={view}
                  onClick={() => setPref("calendarView", view)}
                  aria-pressed={prefs.calendarView === view}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    prefs.calendarView === view
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        {migrated > 0 && (
          <div className="flex items-center justify-between gap-3 bg-muted/40 text-muted-foreground p-3 rounded-md mb-4 text-sm">
            <span>
              Moved {migrated} entr{migrated === 1 ? "y" : "ies"} from your old
              schedule into the calendar as events.
            </span>
            <button
              onClick={() => setMigrated(0)}
              className="text-xs hover:text-foreground flex-shrink-0"
            >
              ok
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-muted-foreground text-center py-6 text-sm">
            loading calendar...
          </div>
        )}

        {!isLoading && isWeek && (
          <WeekGrid
            days={weekDays}
            itemsByDate={itemsByDate}
            spaceById={spaceById}
            colors={prefs.colors}
            isDone={isDone}
            onToggleDone={toggleDone}
            today={today}
            selected={selected}
            onSelectDay={setSelected}
          />
        )}

        {!isLoading && !isWeek && (
          <>
            <div className="grid grid-cols-7 gap-px mb-px">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-xs text-muted-foreground text-center py-1"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
              {weeks.flat().map((day) => {
                const dayItems = itemsByDate.get(day.key) || [];
                const shown = dayItems.slice(0, CHIPS_PER_CELL);
                const extra = dayItems.length - shown.length;
                const isToday = day.key === today;
                const isSelected = day.key === selected;
                const overdue = overdueByDate.get(day.key) || 0;

                return (
                  // A div rather than a button: the chips inside are
                  // interactive, and nesting buttons isn't valid. The day
                  // number carries the accessible name and keyboard focus.
                  <div
                    key={day.key}
                    onClick={() => pickDay(day.key)}
                    className={`min-h-[5.5rem] p-1.5 text-left align-top cursor-pointer transition-colors ${
                      day.inMonth ? "bg-card" : "bg-muted/30"
                    } ${isSelected ? "ring-1 ring-inset ring-ring" : "hover:bg-muted/40"}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          pickDay(day.key);
                        }}
                        aria-label={longDayLabel(day.key)}
                        aria-pressed={isSelected}
                        className={`text-xs w-5 h-5 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-primary text-primary-foreground font-medium"
                            : day.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {day.dayOfMonth}
                      </button>
                      {overdue > 0 && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-destructive"
                          title={`${overdue} overdue`}
                        />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      {shown.map((item) => (
                        <DayChip
                          key={item.id}
                          label={item.title}
                          time={
                            item.when.time
                              ? formatTime(item.when.time).replace(":00", "")
                              : ""
                          }
                          done={isDone(item)}
                          onToggle={
                            item.when.mode === "due"
                              ? () => toggleDone(item)
                              : undefined
                          }
                          onSelect={() => pickDay(day.key)}
                          className={chipClass(item)}
                        />
                      ))}
                      {extra > 0 && (
                        <div className="text-[11px] text-muted-foreground px-1">
                          +{extra} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected day: add, edit and delete, same as the work list */}
      {!isLoading && (
        <div className="bg-card shadow rounded-md p-6 transition-colors duration-200">
          <div className="flex items-baseline justify-between pb-4">
            <h3 className="text-sm font-medium text-foreground">
              {selected === today ? "Today" : longDayLabel(selected)}
            </h3>
            {selectedItems.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedItems.length} item
                {selectedItems.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <QuickAdd
            spaces={activeSpaces}
            onSubmit={addItem}
            defaultDate={selected}
            placeholder={`Add to ${
              selected === today ? "today" : longDayLabel(selected)
            }`}
          />

          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 mt-4 text-center bg-muted/40 rounded-md border border-dashed border-border">
              nothing on this day.
            </p>
          ) : (
            <div className={prefs.table ? "mt-6" : "mt-2"}>
              <WorkList
                groups={dayGroups}
                spaces={activeSpaces}
                spaceById={spaceById}
                prefs={prefs}
                isDone={isDone}
                onToggleDone={toggleDone}
                onPatch={patch}
                onDelete={deleteItem}
                expandedId={expandedId}
                onExpand={setExpandedId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
