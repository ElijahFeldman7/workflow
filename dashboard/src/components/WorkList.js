import React, { useState } from "react";
import { InlineText, InlineDate, DoneBox, EventMark } from "./InlineFields";
import { IconButton, PencilIcon, TrashIcon } from "./Icons";
import {
  WORK_TYPES,
  PRIORITIES,
  MODES,
  NEUTRAL_CHIP,
  bucketFor,
  colorOf,
  formatWhen,
  priorityOf,
  typeChip,
  typeLabel,
} from "../constants/work";

const MetaPill = ({ label, onClick, active, className, tag, muted }) => {
  if (!label) return null;

  const base = tag
    ? `text-xs px-2 py-0.5 rounded ${className || NEUTRAL_CHIP}`
    : `text-xs ${className || (muted ? "text-muted-foreground" : "")}`;
  const ring = active ? "ring-1 ring-ring/50" : "";

  if (!onClick) return <span className={`${base} ${ring}`}>{label}</span>;

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      title={`Filter by ${label}`}
      className={`${base} ${ring} hover:text-foreground transition-colors`}
    >
      {label}
    </button>
  );
};

const field =
  "w-full mt-1 border border-border rounded px-2 py-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40";
const fieldLabel = "text-xs text-muted-foreground";

const DetailsStrip = ({ item, spaces, onPatch, onClose }) => (
  <div className="px-3 py-3 mb-1 bg-muted/40 rounded-md">
    <div className="grid gap-3 sm:grid-cols-4">
      <div>
        <label className={fieldLabel}>Class</label>
        <select
          value={item.spaceId}
          onChange={(e) => onPatch({ spaceId: e.target.value })}
          className={field}
          aria-label="Class"
        >
          <option value="">None</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {space.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabel}>Type</label>
        <select
          value={item.type}
          onChange={(e) => onPatch({ type: e.target.value })}
          className={field}
          aria-label="Type"
        >
          <option value="">None</option>
          {WORK_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabel}>Priority</label>
        <select
          value={item.priority}
          onChange={(e) => onPatch({ priority: e.target.value })}
          className={field}
          aria-label="Priority"
        >
          {PRIORITIES.map((priority) => (
            <option key={priority.id} value={priority.id}>
              {priority.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabel}>Kind</label>
        <select
          value={item.when.mode}
          onChange={(e) =>
            onPatch({ when: { ...item.when, mode: e.target.value } })
          }
          className={field}
          aria-label="Deadline or event"
        >
          {MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.id === "due" ? "Due date" : "Event"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabel}>
          {item.when.mode === "event" ? "Starts" : "Time"}
        </label>
        <input
          type="time"
          value={item.when.time}
          onChange={(e) =>
            onPatch({ when: { ...item.when, time: e.target.value } })
          }
          className={`${field} dark:[color-scheme:dark]`}
          aria-label="Start time"
        />
      </div>

      {item.when.mode === "event" && (
        <>
          <div>
            <label className={fieldLabel}>Ends</label>
            <input
              type="time"
              value={item.when.endTime}
              onChange={(e) =>
                onPatch({ when: { ...item.when, endTime: e.target.value } })
              }
              className={`${field} dark:[color-scheme:dark]`}
              aria-label="End time"
            />
          </div>
          <div>
            <label className={fieldLabel}>Location</label>
            <input
              type="text"
              value={item.location}
              onChange={(e) => onPatch({ location: e.target.value })}
              className={field}
              aria-label="Location"
            />
          </div>
        </>
      )}

      <div
        className={item.when.mode === "event" ? "sm:col-span-4" : "sm:col-span-3"}
      >
        <label className={fieldLabel}>Notes</label>
        <textarea
          value={item.notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          rows={2}
          className={`${field} resize-none`}
          aria-label="Notes"
        />
      </div>
    </div>

    <div className="flex justify-end mt-2">
      <button
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
      >
        close
      </button>
    </div>
  </div>
);

const RowActions = ({ item, expanded, onExpand, onDelete }) => (
  <span className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
    <IconButton
      onClick={onExpand}
      active={expanded}
      title="Edit details"
      label={`Edit ${item.title}`}
    >
      <PencilIcon />
    </IconButton>
    <IconButton
      onClick={onDelete}
      danger
      title="Delete"
      label={`Delete ${item.title}`}
    >
      <TrashIcon />
    </IconButton>
  </span>
);

const noFilters = { spaces: [], types: [], priorities: [] };

const WorkList = ({
  groups,
  spaces,
  spaceById,
  prefs,
  isDone,
  onToggleDone,
  onPatch,
  onDelete,
  expandedId,
  onExpand,
  activeFilters = noFilters,
  onToggleFilter,
  footer,
}) => {
  const [openGroups, setOpenGroups] = useState({});

  const isGroupOpen = (group) =>
    !group.collapsible || !!openGroups[group.id];

  const toggleGroup = (id) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const groupHeading = (group) => {
    if (!group.label) return null;
    const tone = group.tone || "text-muted-foreground";
    if (!group.collapsible)
      return <div className={`text-xs ${tone}`}>{group.label}</div>;

    const open = isGroupOpen(group);
    return (
      <button
        onClick={() => toggleGroup(group.id)}
        aria-expanded={open}
        className={`flex items-center gap-1 text-xs ${tone} hover:text-foreground transition-colors`}
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {group.label}
        <span className="text-muted-foreground">({group.items.length})</span>
      </button>
    );
  };

  const filterHandler = (kind, value) =>
    onToggleFilter && value ? () => onToggleFilter(kind, value) : undefined;

  const box = (item) =>
    item.when.mode === "event" ? (
      <EventMark />
    ) : (
      <DoneBox
        done={isDone(item)}
        onToggle={() => onToggleDone(item)}
        label={`Mark ${item.title} as ${isDone(item) ? "not done" : "done"}`}
      />
    );

  const title = (item) => (
    <InlineText
      value={item.title}
      onChange={(next) => onPatch(item, { title: next })}
      label="Title"
      className={
        isDone(item) ? "line-through text-muted-foreground" : "text-foreground"
      }
    />
  );

  const dateCell = (item) => (
    <InlineDate
      value={item.when.date}
      display={item.when.date ? formatWhen(item) : ""}
      onChange={(date) => onPatch(item, { when: { ...item.when, date } })}
      label={`Date for ${item.title}`}
      className={
        !isDone(item) && bucketFor(item) === "overdue"
          ? "text-destructive"
          : "text-muted-foreground"
      }
    />
  );

  const details = (item) =>
    expandedId === item.id && (
      <DetailsStrip
        item={item}
        spaces={spaces}
        onPatch={(changes) => onPatch(item, changes)}
        onClose={() => onExpand(null)}
      />
    );

  const actions = (item) => (
    <RowActions
      item={item}
      expanded={expandedId === item.id}
      onExpand={() => onExpand(expandedId === item.id ? null : item.id)}
      onDelete={() => onDelete(item)}
    />
  );

  if (prefs.table) {
    const shownGroups = groups.filter(isGroupOpen);
    const rows = shownGroups.flatMap((group) => group.items);
    const collapsed = groups.filter((group) => !isGroupOpen(group));

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="w-8 font-normal py-2"> </th>
              <th className="font-normal py-2">Name</th>
              <th className="font-normal py-2 px-3">Due</th>
              <th className="font-normal py-2 px-3">Type</th>
              <th className="font-normal py-2 px-3">Class</th>
              <th className="font-normal py-2 px-3">Priority</th>
              <th className="w-16 font-normal py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const space = spaceById.get(item.spaceId);
              const priority = priorityOf(item.priority);

              return (
                <React.Fragment key={item.id}>
                  <tr className="group border-b border-border hover:bg-muted/40 transition-colors">
                    <td className="py-2 pr-2 align-middle">{box(item)}</td>
                    <td className="py-2 pr-3 max-w-0 w-full">{title(item)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{dateCell(item)}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <MetaPill
                        tag
                        label={typeLabel(item.type)}
                        className={prefs.colors ? typeChip(item.type) : undefined}
                        active={activeFilters.types.includes(item.type)}
                        onClick={filterHandler("types", item.type)}
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <MetaPill
                        tag
                        label={space?.name}
                        className={
                          space && prefs.colors
                            ? colorOf(space.color).chip
                            : undefined
                        }
                        active={activeFilters.spaces.includes(item.spaceId)}
                        onClick={filterHandler("spaces", item.spaceId)}
                      />
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <MetaPill
                        tag
                        label={priority.label}
                        className={
                          prefs.colors || item.priority === "insane"
                            ? priority.chip
                            : undefined
                        }
                        active={activeFilters.priorities.includes(item.priority)}
                        onClick={filterHandler("priorities", item.priority)}
                      />
                    </td>
                    <td className="py-2 text-right">{actions(item)}</td>
                  </tr>
                  {expandedId === item.id && (
                    <tr>
                      <td colSpan={7} className="pb-1">
                        {details(item)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {collapsed.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {collapsed.map((group) => (
              <React.Fragment key={group.id}>{groupHeading(group)}</React.Fragment>
            ))}
          </div>
        )}
        {footer}
      </div>
    );
  }

  const showHeadings = groups.length > 1 || !!groups[0]?.label;

  return (
    <div>
      {groups.map((group) => (
        <div key={group.id} className="mt-5 first:mt-3">
          {showHeadings && groupHeading(group)}

          {isGroupOpen(group) && (
          <ul className="divide-y divide-border">
            {group.items.map((item) => {
              const space = spaceById.get(item.spaceId);
              const priority = priorityOf(item.priority);
              const filed = isDone(item);

              return (
                <li key={item.id}>
                  <div className="group flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {box(item)}

                      {prefs.colors && space && (
                        <span
                          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            colorOf(space.color).dot
                          } ${filed ? "opacity-30" : ""}`}
                          title={space.name}
                        />
                      )}

                      <div className="min-w-0 flex-1">{title(item)}</div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                        <MetaPill
                          muted
                          label={space?.name}
                          active={activeFilters.spaces.includes(item.spaceId)}
                          onClick={filterHandler("spaces", item.spaceId)}
                        />
                        <MetaPill
                          muted
                          label={typeLabel(item.type)}
                          active={activeFilters.types.includes(item.type)}
                          onClick={filterHandler("types", item.type)}
                        />
                        <MetaPill
                          label={priority.label}
                          className={
                            item.priority === "insane" && !filed
                              ? "font-bold text-destructive"
                              : "text-muted-foreground"
                          }
                          active={activeFilters.priorities.includes(item.priority)}
                          onClick={filterHandler("priorities", item.priority)}
                        />
                        {dateCell(item)}
                      </span>

                      {actions(item)}
                    </div>
                  </div>

                  {details(item)}
                </li>
              );
            })}
          </ul>
          )}

          {group.id === "done" && group.hidden > 0 && isGroupOpen(group) && footer}
        </div>
      ))}

      {groups.every((group) => group.id !== "done") && footer}
    </div>
  );
};

export default WorkList;
