import React, { useMemo, useRef, useState } from "react";
import Backlog from "./planner/Backlog";
import DayTray from "./planner/DayTray";
import DayGrid from "./planner/DayGrid";
import WeekBoard from "./planner/WeekBoard";
import PlanMenu from "./planner/PlanMenu";
import CarryOver from "./planner/CarryOver";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import { usePlanner } from "../lib/usePlanner";
import { useGoogleSync } from "../lib/useGoogleSync";
import { useWorkPrefs } from "../lib/workPrefs";
import { useCaptureMemory } from "../lib/useCaptureMemory";
import {
  backlogGroups,
  carryOver,
  dayEntries,
  planMinutes,
} from "../lib/planner";
import { longDayLabel, shiftWeek, weekLabel, weekMatrix } from "../lib/calendar";
import { addDaysKey, todayKey } from "../constants/work";
import { shortDay } from "./planner/shared";

const Planner = ({ user }) => {
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [menuId, setMenuId] = useState(null);
  const [prefs, setPref] = useWorkPrefs();
  const { memory, learn } = useCaptureMemory(user);
  // What is being dragged, shared by every list it can be dropped on.
  const drag = useRef(null);

  const isWeek = prefs.plannerView === "week";
  const weekDays = useMemo(() => weekMatrix(selected), [selected]);
  const dateKeys = useMemo(
    () => (isWeek ? weekDays.map((day) => day.key) : [selected]),
    [isWeek, weekDays, selected]
  );

  const planner = usePlanner(user, dateKeys);
  const { entries, spaceById, isDone, toggleDone, plan, unplan } = planner;
  // Mounted here so Google's events stay current without a visit to Calendar.
  const gcal = useGoogleSync(user);

  const day = useMemo(() => dayEntries(entries, selected), [entries, selected]);
  const groups = useMemo(
    () => backlogGroups(entries, dateKeys, isDone),
    [entries, dateKeys, isDone]
  );
  const leftover = useMemo(
    () => carryOver(entries, today, isDone),
    [entries, today, isDone]
  );

  const menuEntry = menuId
    ? entries.find((entry) => entry.id === menuId) || null
    : null;

  const dayLabel = shortDay(selected, today);
  const step = (delta) =>
    setSelected((key) => (isWeek ? shiftWeek(key, delta) : addDaysKey(key, delta)));

  const openDay = (key) => {
    setSelected(key);
    setPref("plannerView", "day");
  };

  const segment = (on) =>
    `px-2.5 py-1 text-xs transition-colors ${
      on ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
    }`;

  return (
    <div className="space-y-4">
      <div className="bg-card shadow rounded-md px-6 py-4 transition-colors duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => step(-1)}
              aria-label={isWeek ? "Previous week" : "Previous day"}
              className="p-1.5 rounded text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <ChevronLeftIcon />
            </button>
            <h2 className="text-xl font-semibold text-foreground truncate">
              {isWeek
                ? weekLabel(weekDays)
                : selected === today
                ? "Today"
                : longDayLabel(selected)}
            </h2>
            <button
              onClick={() => step(1)}
              aria-label={isWeek ? "Next week" : "Next day"}
              className="p-1.5 rounded text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {selected !== today && (
              <button
                onClick={() => setSelected(today)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
              >
                today
              </button>
            )}
            <div className="flex rounded overflow-hidden border border-border">
              {["day", "week"].map((view) => (
                <button
                  key={view}
                  onClick={() => setPref("plannerView", view)}
                  aria-pressed={prefs.plannerView === view}
                  className={segment(prefs.plannerView === view)}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </div>

        {planner.error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mt-4 text-sm">
            {planner.error}
          </div>
        )}

        {gcal.connected && gcal.status === "error" && gcal.message && (
          <div className="flex items-center justify-between gap-3 bg-destructive/10 text-destructive p-3 rounded-md mt-4 text-sm">
            <span>{gcal.message}</span>
            {gcal.needsAuth && (
              <button
                onClick={gcal.connectGoogle}
                className="text-xs font-medium hover:underline flex-shrink-0"
              >
                Reconnect
              </button>
            )}
          </div>
        )}
      </div>

      <CarryOver
        entries={leftover}
        today={today}
        onMove={(entry) => plan(entry, { date: today, time: "" })}
        onDrop={unplan}
      />

      {planner.isLoading ? (
        <div className="text-muted-foreground text-center py-6 text-sm">
          fetching your plan...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] items-start">
          <div className="order-2 lg:order-1">
            <Backlog
              groups={groups}
              spaceById={spaceById}
              colors={prefs.colors}
              today={today}
              dayLabel={dayLabel}
              drag={drag}
              onToggleDone={toggleDone}
              onPlan={(entry) => plan(entry, { date: selected, time: "" })}
              onUnplan={unplan}
              onOpen={(entry) => setMenuId(entry.id)}
            />
          </div>

          <div className="order-1 lg:order-2 bg-card shadow rounded-md p-4 transition-colors duration-200 min-w-0">
            {isWeek ? (
              <WeekBoard
                days={weekDays}
                entries={entries}
                today={today}
                spaceById={spaceById}
                colors={prefs.colors}
                drag={drag}
                isDone={isDone}
                onToggleDone={toggleDone}
                onPlanFor={(entry, key) => plan(entry, { date: key })}
                onOpenDay={openDay}
                onOpen={(entry) => setMenuId(entry.id)}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <DayTray
                  tray={day.tray}
                  timed={day.timed}
                  dayLabel={dayLabel}
                  drag={drag}
                  isDone={isDone}
                  onToggleDone={toggleDone}
                  onAdd={(parsed) => planner.addTodo(parsed, selected)}
                  onDropHere={(entry) => plan(entry, { date: selected, time: "" })}
                  onOpen={(entry) => setMenuId(entry.id)}
                  memory={memory}
                  onLearn={learn}
                />
                <DayGrid
                  fixed={day.fixed}
                  timed={day.timed}
                  isToday={selected === today}
                  spaceById={spaceById}
                  colors={prefs.colors}
                  drag={drag}
                  isDone={isDone}
                  onToggleDone={toggleDone}
                  onDropAt={(entry, time) =>
                    plan(entry, {
                      date: selected,
                      time,
                      minutes: planMinutes(entry),
                    })
                  }
                  onResize={(entry, minutes) => plan(entry, { minutes })}
                  onOpen={(entry) => setMenuId(entry.id)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {menuEntry && (
        <PlanMenu
          entry={menuEntry}
          today={today}
          selected={selected}
          done={isDone(menuEntry)}
          repeat={planner.repeatById.get(menuEntry.repeatId) || null}
          onToggleDone={() => toggleDone(menuEntry)}
          onRename={(title) => planner.patch(menuEntry, { title })}
          onPlan={(changes) => plan(menuEntry, changes)}
          onUnplan={() => unplan(menuEntry)}
          onWhen={(changes) =>
            planner.patch(menuEntry, { when: { ...menuEntry.when, ...changes } })
          }
          onRepeat={(weekdays) =>
            weekdays.length === 0
              ? planner.stopRepeat(menuEntry.repeatId)
              : planner.saveRepeat(menuEntry, weekdays)
          }
          onStopRepeat={() => planner.stopRepeat(menuEntry.repeatId)}
          onDelete={() => {
            setMenuId(null);
            planner.deleteEntry(menuEntry);
          }}
          onClose={() => setMenuId(null)}
        />
      )}
    </div>
  );
};

export default Planner;
