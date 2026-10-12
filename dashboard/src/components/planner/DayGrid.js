import React, { useEffect, useMemo, useRef, useState } from "react";
import { hourRange, layoutBlocks } from "../../lib/calendar";
import {
  SNAP_MINUTES,
  dayBlocks,
  minutesAtOffset,
  planMinutes,
  snapMinutes,
  timeOfMinutes,
} from "../../lib/planner";
import { DoneBox } from "../InlineFields";
import { isTimeValue } from "../../constants/work";
import {
  FIXED_TONE,
  PX_PER_MINUTE,
  chipTone,
  dragSource,
  dropTarget,
  spanLabel,
} from "./shared";

const MIN_BLOCK_HEIGHT = 22;
const EDGE_PAD = 10;

const hourLabel = (hour) => {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${hour >= 12 ? "PM" : "AM"}`;
};

// One day by the hour. Fixed things sit where they are; planned ones can be
// dropped in, dragged to another time, and stretched from their bottom edge.
const DayGrid = ({
  fixed,
  timed,
  isToday,
  spaceById,
  colors,
  drag,
  isDone,
  onToggleDone,
  onDropAt,
  onResize,
  onOpen,
}) => {
  const scrollRef = useRef(null);
  const [stretch, setStretch] = useState(null);
  // Where the thing being dragged would land if it were let go now.
  const [landing, setLanding] = useState(null);

  // A drag given up outside the grid never reaches it as a drop or a leave.
  useEffect(() => {
    const clear = () => setLanding(null);
    window.addEventListener("dragend", clear);
    return () => window.removeEventListener("dragend", clear);
  }, []);

  const allDay = useMemo(
    () => fixed.filter((entry) => !isTimeValue(entry.when.time)),
    [fixed]
  );

  const blocks = useMemo(() => {
    const raw = dayBlocks(fixed, timed).map((block) =>
      stretch && stretch.id === block.item.id
        ? { ...block, end: block.start + stretch.minutes }
        : block
    );
    return layoutBlocks(raw);
  }, [fixed, timed, stretch]);

  const range = useMemo(() => hourRange(blocks, 7, 22), [blocks]);
  const gridTop = range.start * 60;
  const height = (range.end - range.start) * 60 * PX_PER_MINUTE + EDGE_PAD * 2;
  const offset = (minutes) => (minutes - gridTop) * PX_PER_MINUTE + EDGE_PAD;

  const hours = [];
  for (let hour = range.start; hour <= range.end; hour += 1) hours.push(hour);

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);
  const nowVisible =
    isToday && nowMinutes >= gridTop && nowMinutes <= range.end * 60;

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const target = nowVisible ? nowMinutes : 8 * 60;
    scroller.scrollTop = Math.max(0, (target - gridTop) * PX_PER_MINUTE - 120);
  }, [nowVisible, nowMinutes, gridTop]);

  // Stretching follows the mouse wherever it goes, so the listeners live on
  // the window for as long as the button is held.
  const startStretch = (event, block) => {
    event.preventDefault();
    event.stopPropagation();
    const fromY = event.clientY;
    const fromMinutes = block.end - block.start;
    let minutes = fromMinutes;

    const move = (moved) => {
      minutes = Math.max(
        SNAP_MINUTES,
        snapMinutes(fromMinutes + (moved.clientY - fromY) / PX_PER_MINUTE)
      );
      setStretch({ id: block.item.id, minutes });
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      setStretch(null);
      if (minutes !== fromMinutes) onResize(block.item, minutes);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  };

  const minutesUnder = (event, grab) => {
    const top = event.currentTarget.getBoundingClientRect().top;
    const y = (event.clientY || 0) - top - (grab || 0) - EDGE_PAD;
    return minutesAtOffset(y, gridTop, PX_PER_MINUTE);
  };

  const drop = dropTarget(drag, (entry, event, grab) => {
    setLanding(null);
    onDropAt(entry, timeOfMinutes(minutesUnder(event, grab)));
  });

  const dropOnGrid = {
    ...drop,
    onDragOver: (event) => {
      drop.onDragOver(event);
      const held = drag.current;
      if (!held) return;
      const start = minutesUnder(event, held.grab);
      const end = start + planMinutes(held.entry);
      setLanding((current) =>
        current && current.start === start && current.end === end
          ? current
          : { start, end, title: held.entry.title }
      );
    },
    onDragLeave: (event) => {
      // Passing over a block inside the column is not leaving it.
      if (!event.currentTarget.contains(event.relatedTarget)) setLanding(null);
    },
  };

  return (
    <section aria-label="Day timeline" className="min-w-0">
      {allDay.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {allDay.map((entry) => (
            <li
              key={entry.id}
              className={`text-[11px] px-1.5 py-0.5 rounded truncate ${FIXED_TONE}`}
              title={entry.title}
            >
              <span className="opacity-70 mr-1">all day</span>
              {entry.title}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={scrollRef}
        className="relative border border-border rounded overflow-y-auto max-h-[36rem]"
      >
        <div className="grid grid-cols-[3.25rem_minmax(0,1fr)]">
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

          <div
            data-testid="day-column"
            className="relative border-l border-border"
            style={{ height }}
            {...dropOnGrid}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-border/60 pointer-events-none"
                style={{ top: offset(hour * 60) }}
              />
            ))}

            {nowVisible && (
              <div
                className="absolute inset-x-0 border-t-2 border-destructive z-10 pointer-events-none"
                style={{ top: offset(nowMinutes) }}
              />
            )}

            {landing && (
              <div
                data-testid="landing"
                className="absolute inset-x-0 z-10 pointer-events-none rounded border-2 border-dashed border-primary bg-primary/15 text-primary text-[11px] leading-tight px-1.5 py-0.5 overflow-hidden"
                style={{
                  top: offset(landing.start),
                  height: Math.max(
                    (landing.end - landing.start) * PX_PER_MINUTE,
                    MIN_BLOCK_HEIGHT
                  ),
                }}
              >
                <span className="block truncate font-medium">
                  {spanLabel(landing.start, landing.end)}
                </span>
              </div>
            )}

            {blocks.map((block) => {
              const { item, start, end, column, columns } = block;
              const blockHeight = Math.max(
                (end - start) * PX_PER_MINUTE,
                MIN_BLOCK_HEIGHT
              );
              const style = {
                top: offset(start),
                height: blockHeight,
                left: `${(column / columns) * 100}%`,
                width: `${(1 / columns) * 100}%`,
              };
              const span = spanLabel(start, end);
              const roomy = blockHeight > MIN_BLOCK_HEIGHT + 12;

              if (block.fixed) {
                const own = item.source !== "google";
                return (
                  <div
                    key={item.id}
                    title={`${item.title} · ${span}`}
                    onClick={own ? () => onOpen(item) : undefined}
                    className={`absolute overflow-hidden text-[11px] leading-tight px-1.5 py-0.5 rounded ${FIXED_TONE} ${
                      own ? "cursor-pointer" : ""
                    }`}
                    style={style}
                  >
                    <span className="block truncate font-medium">{item.title}</span>
                    {roomy && <span className="block truncate opacity-70">{span}</span>}
                  </div>
                );
              }

              const done = isDone(item);
              return (
                <div
                  key={item.id}
                  title={`${item.title} · ${span}`}
                  className={`absolute overflow-hidden text-[11px] leading-tight px-1 py-0.5 rounded border border-card cursor-grab ${chipTone(
                    item,
                    { spaceById, colors, done }
                  )}`}
                  style={style}
                  {...dragSource(drag, item)}
                >
                  <div className="flex items-start gap-1">
                    <DoneBox
                      small
                      done={done}
                      onToggle={() => onToggleDone(item)}
                      label={`Mark ${item.title} as ${done ? "not done" : "done"}`}
                    />
                    <button
                      onClick={() => onOpen(item)}
                      aria-label={`Open ${item.title}, ${span}`}
                      className="min-w-0 flex-grow text-left"
                    >
                      <span className="block truncate font-medium">{item.title}</span>
                      {roomy && (
                        <span className="block truncate opacity-70">{span}</span>
                      )}
                    </button>
                  </div>
                  <div
                    role="separator"
                    aria-label={`Change the length of ${item.title}`}
                    onMouseDown={(event) => startStretch(event, block)}
                    className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize hover:bg-foreground/20"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DayGrid;
