import React, { useState, useMemo } from "react";
import QuickAdd from "./QuickAdd";
import WorkList from "./WorkList";
import { FilterChips } from "./InlineFields";
import { useWorkData } from "../lib/useWorkData";
import { useWorkWrites } from "../lib/useWorkWrites";
import { useWorkPrefs } from "../lib/workPrefs";
import { useCaptureMemory } from "../lib/useCaptureMemory";
import {
  WORK_TYPES,
  PRIORITIES,
  BUCKETS,
  bucketFor,
  colorOf,
  sortByDate,
  typeChip,
} from "../constants/work";

const DONE_VISIBLE = 8;

const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const WorkTracker = ({ user }) => {
  const { activeSpaces, spaceById, items, isLoading, error, setError } =
    useWorkData(user);
  const [prefs] = useWorkPrefs();
  const { memory, learn } = useCaptureMemory(user);
  const { patch, isDone, toggleDone, deleteItem, addItem } = useWorkWrites(
    user,
    activeSpaces,
    setError
  );

  const [expandedId, setExpandedId] = useState(null);
  const [filters, setFilters] = useState({
    spaces: [],
    types: [],
    priorities: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  const overdueCount = useMemo(
    () =>
      items.filter((item) => !item.done && bucketFor(item) === "overdue").length,
    [items]
  );

  const filterOptions = useMemo(() => {
    const usedSpaces = new Set();
    const usedTypes = new Set();
    const usedPriorities = new Set();
    items.forEach((item) => {
      if (item.done) return;
      if (!prefs.showPast && bucketFor(item) === "past") return;
      if (item.spaceId) usedSpaces.add(item.spaceId);
      if (item.type) usedTypes.add(item.type);
      usedPriorities.add(item.priority);
    });

    return {
      spaces: activeSpaces
        .filter((space) => usedSpaces.has(space.id))
        .map((space) => ({
          value: space.id,
          label: space.name,
          dot: colorOf(space.color).dot,
          className: prefs.colors ? colorOf(space.color).chip : undefined,
        })),
      types: WORK_TYPES.filter((type) => usedTypes.has(type.id)).map((type) => ({
        value: type.id,
        label: type.label,
        className: prefs.colors ? typeChip(type.id) : undefined,
      })),
      priorities: PRIORITIES.filter((p) => usedPriorities.has(p.id)).map((p) => ({
        value: p.id,
        label: p.label,
        className: p.chip,
      })),
    };
  }, [items, activeSpaces, prefs.colors, prefs.showPast]);

  const hasAnyFilterOption =
    filterOptions.spaces.length > 0 ||
    filterOptions.types.length > 0 ||
    filterOptions.priorities.length > 0;

  const activeFilterCount =
    filters.spaces.length + filters.types.length + filters.priorities.length;

  const toggleFilter = (kind, value) =>
    setFilters((prev) => ({
      spaces: kind === "spaces" ? toggle(prev.spaces, value) : prev.spaces,
      types: kind === "types" ? toggle(prev.types, value) : prev.types,
      priorities:
        kind === "priorities" ? toggle(prev.priorities, value) : prev.priorities,
    }));

  const clearFilters = () =>
    setFilters({ spaces: [], types: [], priorities: [] });

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (!prefs.showPast && !isDone(item) && bucketFor(item) === "past")
          return false;
        if (filters.spaces.length && !filters.spaces.includes(item.spaceId))
          return false;
        if (filters.types.length && !filters.types.includes(item.type))
          return false;
        if (
          filters.priorities.length &&
          !filters.priorities.includes(item.priority)
        )
          return false;
        return true;
      }),
    [items, filters, prefs.showPast, isDone]
  );

  const groups = useMemo(() => {
    const byBucket = new Map();
    visible.forEach((item) => {
      const bucket = isDone(item) ? "done" : bucketFor(item);
      const list = byBucket.get(bucket) || [];
      list.push(item);
      byBucket.set(bucket, list);
    });

    const ordered = [];
    BUCKETS.forEach((bucket) => {
      const list = byBucket.get(bucket.id);
      if (list && list.length)
        ordered.push({
          ...bucket,
          collapsible: bucket.id === "past",
          items: [...list].sort(
            bucket.id === "past" ? (a, b) => sortByDate(b, a) : sortByDate
          ),
        });
    });

    const done = byBucket.get("done");
    if (done && done.length) {
      const sorted = [...done].sort((a, b) => b.completedAt - a.completedAt);
      ordered.push({
        id: "done",
        label: "Done",
        tone: "",
        items: showAllDone ? sorted : sorted.slice(0, DONE_VISIBLE),
        hidden: showAllDone ? 0 : Math.max(0, sorted.length - DONE_VISIBLE),
      });
    }

    return ordered;
  }, [visible, isDone, showAllDone]);

  const filedCount = useMemo(
    () => visible.filter(isDone).length,
    [visible, isDone]
  );

  const filterPanel = showFilters && (
    <div className="mt-3 p-3 bg-muted/40 rounded-md">
      {[
        {
          key: "spaces",
          heading: "Class",
          options: filterOptions.spaces,
          active: filters.spaces,
        },
        {
          key: "types",
          heading: "Type",
          options: filterOptions.types,
          active: filters.types,
        },
        {
          key: "priorities",
          heading: "Priority",
          options: filterOptions.priorities,
          active: filters.priorities,
        },
      ]
        .filter((row) => row.options.length > 0)
        .map((row) => (
          <div key={row.key} className="flex items-baseline gap-3 py-1">
            <span className="text-xs text-muted-foreground w-14 flex-shrink-0">
              {row.heading}
            </span>
            <div className="flex flex-wrap gap-1">
              <FilterChips
                options={row.options}
                active={row.active}
                onToggle={(value) => toggleFilter(row.key, value)}
              />
            </div>
          </div>
        ))}

      {activeFilterCount > 0 && (
        <button
          onClick={clearFilters}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          clear filters
        </button>
      )}
    </div>
  );

  const doneFooter = filedCount > DONE_VISIBLE && (
    <button
      onClick={() => setShowAllDone(!showAllDone)}
      className="mt-4 text-xs text-muted-foreground hover:text-foreground"
    >
      {showAllDone ? "collapse done" : `show all ${filedCount} done`}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto bg-card shadow rounded-md p-6 transition-colors duration-200">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-xl font-semibold text-foreground">work</h2>

        <div className="flex items-center gap-3">
          {overdueCount > 0 && (
            <span className="text-sm text-destructive">
              {overdueCount} overdue
            </span>
          )}
          {hasAnyFilterOption && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              aria-pressed={showFilters}
              aria-label="Filters"
              title="Filters"
              className={`flex items-center gap-1 p-1.5 rounded transition-colors ${
                showFilters || activeFilterCount > 0
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4h18l-7 8v6l-4 2v-8L3 4z"
                />
              </svg>
              {activeFilterCount > 0 && (
                <span className="text-xs">{activeFilterCount}</span>
              )}
            </button>
          )}
        </div>
      </div>

      <QuickAdd
        spaces={activeSpaces}
        onSubmit={addItem}
        memory={memory}
        onLearn={learn}
      />

      {filterPanel}

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mt-4 text-sm">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="text-muted-foreground text-center py-6 text-sm">
          fetching work...
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="text-muted-foreground text-center py-8 mt-4 bg-muted/40 rounded-md border border-dashed border-border text-sm">
          {items.length === 0
            ? "nothing tracked yet."
            : "nothing matches these filters."}
        </div>
      )}

      {!isLoading && visible.length > 0 && (
        <div className={prefs.table ? "mt-6" : "mt-2"}>
          <WorkList
            groups={groups}
            spaces={activeSpaces}
            spaceById={spaceById}
            prefs={prefs}
            isDone={isDone}
            onToggleDone={toggleDone}
            onPatch={patch}
            onDelete={deleteItem}
            expandedId={expandedId}
            onExpand={setExpandedId}
            activeFilters={filters}
            onToggleFilter={toggleFilter}
            footer={doneFooter}
          />
        </div>
      )}
    </div>
  );
};

export default WorkTracker;
