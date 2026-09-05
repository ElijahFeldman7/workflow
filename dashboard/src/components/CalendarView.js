import React, { useState, useMemo, useEffect } from "react";
import QuickAdd from "./QuickAdd";
import WorkList from "./WorkList";
import WeekGrid from "./WeekGrid";
import { DayChip } from "./InlineFields";
import { useWorkData } from "../lib/useWorkData";
import { useWorkWrites } from "../lib/useWorkWrites";
import { useWorkPrefs } from "../lib/workPrefs";
import { useCaptureMemory } from "../lib/useCaptureMemory";
import { useTaskData } from "../lib/useTaskData";
import { useTaskWrites } from "../lib/useTaskWrites";
import { useAgenda, SOURCES } from "../lib/useAgenda";
import { useGoogleSync } from "../lib/useGoogleSync";
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
  const { tasks, isLoading: tasksLoading } = useTaskData(user);
  const [sources, setSources] = useState(["work", "task"]);
  const [prefs, setPref] = useWorkPrefs();
  const { memory, learn } = useCaptureMemory(user);
  const workWrites = useWorkWrites(user, activeSpaces, setError);
  const taskWrites = useTaskWrites(user, setError);
  const { addItem } = workWrites;

  const routed = (entry) =>
    entry.source === "task"
      ? { writes: taskWrites, target: { ...entry, id: entry.taskId } }
      : { writes: workWrites, target: entry };

  const isDone = (entry) => {
    const { writes, target } = routed(entry);
    return writes.isDone(target);
  };
  const toggleDone = (entry) => {
    const { writes, target } = routed(entry);
    return writes.toggleDone(target);
  };
  const patch = (entry, changes) => {
    const { writes, target } = routed(entry);
    return writes.patch(target, changes);
  };
  const deleteItem = (entry) => {
    const { writes, target } = routed(entry);
    return writes.deleteItem(target);
  };

  const today = todayKey();
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [expandedId, setExpandedId] = useState(null);
  const [migrated, setMigrated] = useState(0);

  const isWeek = prefs.calendarView === "week";

  const gcal = useGoogleSync(user, items, !isLoading);

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
  const agenda = useAgenda(items, tasks, sources);
  const itemsByDate = useMemo(() => byDate(agenda), [agenda]);

  const selectedItems = itemsByDate.get(selected) || [];

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

  const overdueByDate = useMemo(() => {
    const map = new Map();
    agenda.forEach((item) => {
      if (item.done || item.when.mode !== "due" || !item.when.date) return;
      if (item.when.date >= today) return;
      map.set(item.when.date, (map.get(item.when.date) || 0) + 1);
    });
    return map;
  }, [agenda, today]);

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
            {gcal.connected && (
              <button
                onClick={gcal.needsAuth ? gcal.connectGoogle : gcal.syncNow}
                disabled={gcal.status === "syncing"}
                title={
                  gcal.needsAuth
                    ? "Reconnect Google Calendar"
                    : `Sync with ${gcal.config.calendarName || "Google Calendar"}`
                }
                aria-label="Sync with Google Calendar"
                className={`p-1.5 rounded transition-colors ${
                  gcal.status === "error"
                    ? "text-destructive hover:bg-muted/60"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <svg
                  className={`w-4 h-4 ${
                    gcal.status === "syncing" ? "animate-spin" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}
            {!onToday && (
              <button
                onClick={goToToday}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
              >
                today
              </button>
            )}
            <div className="flex rounded overflow-hidden border border-border">
              {SOURCES.map((source) => (
                <button
                  key={source.id}
                  onClick={() =>
                    setSources((current) =>
                      current.includes(source.id)
                        ? current.filter((id) => id !== source.id)
                        : [...current, source.id]
                    )
                  }
                  aria-pressed={sources.includes(source.id)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    sources.includes(source.id)
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {source.label}
                </button>
              ))}
            </div>
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

        {!isLoading && !tasksLoading && isWeek && (
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

        {!isLoading && !tasksLoading && !isWeek && (
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
            memory={memory}
            onLearn={learn}
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
