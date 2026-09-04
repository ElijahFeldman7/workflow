import React, { useMemo, useRef, useEffect } from "react";
import { layoutTimed, hourRange, isTimedBlock } from "../lib/calendar";
import { NEUTRAL_CHIP, colorOf, formatTime, priorityOf } from "../constants/work";

const PX_PER_MINUTE = 0.8; // 48px per hour
// Breathing room so the first and last hour labels aren't clipped in half by
// the edge of the grid.
const EDGE_PAD = 10;

const COLUMNS = "grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]";

const hourLabel = (hour) => {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${hour >= 12 ? "PM" : "AM"}`;
};

const WeekGrid = ({
  days,
  itemsByDate,
  spaceById,
  colors,
  isDone,
  today,
  selected,
  onSelectDay,
}) => {
  const scrollRef = useRef(null);
  const timedRef = useRef(null);

  // Lay every day out first: the hour window is shared across all seven so
  // the rows line up, and it has to fit the widest day.
  const perDay = useMemo(
    () =>
      days.map((day) => {
        const dayItems = itemsByDate.get(day.key) || [];
        return {
          day,
          blocks: layoutTimed(dayItems),
          untimed: dayItems.filter((item) => !isTimedBlock(item)),
        };
      }),
    [days, itemsByDate]
  );

  const range = useMemo(
    () => hourRange(perDay.flatMap((entry) => entry.blocks)),
    [perDay]
  );

  const gridTop = range.start * 60;
  const height = (range.end - range.start) * 60 * PX_PER_MINUTE + EDGE_PAD * 2;
  const offset = (minutes) => (minutes - gridTop) * PX_PER_MINUTE + EDGE_PAD;

  const hours = useMemo(() => {
    const list = [];
    for (let hour = range.start; hour <= range.end; hour += 1) list.push(hour);
    return list;
  }, [range.start, range.end]);

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);

  const showsToday = days.some((day) => day.key === today);
  const nowVisible =
    showsToday && nowMinutes >= gridTop && nowMinutes <= range.end * 60;

  // Open on the current time when the week includes today, otherwise at the
  // top of the window. The offset is measured from the timed area's position
  // inside the scroller, since the header rows sit above it.
  const nowTarget = useMemo(
    () =>
      nowVisible ? (nowMinutes - gridTop) * PX_PER_MINUTE + EDGE_PAD : null,
    [nowVisible, nowMinutes, gridTop]
  );

  useEffect(() => {
    const scroller = scrollRef.current;
    const timed = timedRef.current;
    if (!scroller || !timed) return;
    scroller.scrollTop =
      nowTarget === null ? 0 : Math.max(0, timed.offsetTop + nowTarget - 160);
  }, [nowTarget]);

  const chipClass = (item) => {
    const space = spaceById.get(item.spaceId);
    if (isDone(item)) return "bg-muted text-muted-foreground line-through";
    if (space && colors) return colorOf(space.color).chip;
    if (item.priority === "insane") return priorityOf("insane").chip;
    return NEUTRAL_CHIP;
  };

  return (
    // One scroll container around every row, so the scrollbar takes width from
    // all of them equally and the columns stay aligned. Header rows are sticky
    // rather than outside the scroller, which is what used to misalign them.
    <div
      ref={scrollRef}
      className="relative border border-border rounded overflow-y-auto max-h-[34rem]"
    >
      <div className="sticky top-0 z-20 bg-card">
        <div className={COLUMNS}>
          <div />
          {days.map((day) => {
            const isToday = day.key === today;
            return (
              <button
                key={day.key}
                onClick={() => onSelectDay(day.key)}
                aria-pressed={day.key === selected}
                className={`py-1.5 text-center border-l border-border transition-colors ${
                  day.key === selected ? "bg-muted/60" : "hover:bg-muted/40"
                }`}
              >
                <div className="text-[11px] text-muted-foreground">
                  {day.weekday}
                </div>
                <div
                  className={`text-sm mx-auto w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground"
                  }`}
                >
                  {day.dayOfMonth}
                </div>
              </button>
            );
          })}
        </div>

        {/* Deadlines and untimed events: moments rather than blocks. */}
        <div className={`${COLUMNS} border-t border-border bg-muted/20`}>
          <div className="text-[10px] text-muted-foreground text-right pr-2 py-1.5">
            all day
          </div>
          {perDay.map(({ day, untimed }) => (
            <div
              key={day.key}
              className="border-l border-border p-1 space-y-0.5 min-h-[2.25rem]"
            >
              {untimed.map((item) => (
                <div
                  key={item.id}
                  title={item.title}
                  className={`text-[11px] leading-tight px-1 py-0.5 rounded truncate ${chipClass(item)}`}
                >
                  {item.title}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Timed events, positioned by clock time. */}
      <div ref={timedRef} className={`${COLUMNS} border-t border-border`}>
        <div className="relative" style={{ height }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute right-2 text-[10px] text-muted-foreground -translate-y-1/2"
              style={{ top: offset(hour * 60) }}
            >
              {hourLabel(hour)}
            </div>
          ))}
        </div>

        {perDay.map(({ day, blocks }) => (
          <div
            key={day.key}
            className={`relative border-l border-border ${
              day.isWeekend ? "bg-muted/20" : ""
            }`}
            style={{ height }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-border/60"
                style={{ top: offset(hour * 60) }}
              />
            ))}

            {nowVisible && day.key === today && (
              <div
                className="absolute inset-x-0 border-t-2 border-destructive z-10 pointer-events-none"
                style={{ top: offset(nowMinutes) }}
              />
            )}

            {blocks.map(({ item, start, end, column, columns }) => {
              const start12 = formatTime(item.when.time);
              const end12 = formatTime(item.when.endTime);
              const blockHeight = (end - start) * PX_PER_MINUTE;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectDay(day.key)}
                  title={`${item.title}${start12 ? ` · ${start12}` : ""}${
                    end12 ? `–${end12}` : ""
                  }`}
                  className={`absolute overflow-hidden text-left text-[11px] leading-tight px-1 py-0.5 rounded border border-card ${chipClass(item)}`}
                  style={{
                    top: offset(start),
                    height: Math.max(blockHeight, 16),
                    left: `${(column / columns) * 100}%`,
                    width: `${(1 / columns) * 100}%`,
                  }}
                >
                  <span className="block truncate font-medium">{item.title}</span>
                  {blockHeight > 32 && start12 && (
                    <span className="block truncate opacity-70">
                      {start12}
                      {end12 ? `–${end12}` : ""}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeekGrid;
