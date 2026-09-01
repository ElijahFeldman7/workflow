import React, { useState, useEffect, useMemo } from "react";
import { database } from "../firebase";
import {
  ref,
  onValue,
  push,
  set,
  update,
  remove,
  child,
} from "firebase/database";
import QuickAdd from "./QuickAdd";
import { useWorkPrefs } from "../lib/workPrefs";
import {
  WORK_TYPES,
  PRIORITIES,
  MODES,
  PALETTE_KEYS,
  BUCKETS,
  NEUTRAL_CHIP,
  bucketFor,
  colorOf,
  formatWhen,
  normalizeItem,
  normalizeSpace,
  priorityOf,
  sortByDate,
  typeChip,
  typeLabel,
} from "../constants/work";

const text = (value) => (typeof value === "string" ? value.trim() : "");

const draftFromItem = (item) => ({
  title: item.title,
  spaceId: item.spaceId,
  type: item.type,
  priority: item.priority,
  mode: item.when.mode,
  date: item.when.date,
  time: item.when.time,
  endTime: item.when.endTime,
  location: item.location,
  notes: item.notes,
});

// Accepts either an edit draft or a parsed quick-add line, which carries no
// notes field of its own.
const payloadFromDraft = (draft) => ({
  title: text(draft.title),
  spaceId: text(draft.spaceId),
  type: draft.type,
  priority: draft.priority,
  location: text(draft.location),
  notes: text(draft.notes),
  when: {
    mode: draft.mode,
    date: text(draft.date),
    time: text(draft.time),
    endTime: draft.mode === "event" ? text(draft.endTime) : "",
  },
});

const field =
  "w-full mt-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40";
const fieldLabel = "text-xs text-muted-foreground";
const tag = "text-xs px-2 py-0.5 rounded";

const EditPanel = ({ draft, setDraft, spaces, onSave, onCancel }) => (
  <div className="p-4 rounded-md border border-dashed border-border bg-muted/40">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="sm:col-span-3">
        <label className={fieldLabel}>Title</label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className={field}
          aria-label="Title"
        />
      </div>

      <div>
        <label className={fieldLabel}>Class</label>
        <select
          value={draft.spaceId}
          onChange={(e) => setDraft({ ...draft, spaceId: e.target.value })}
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
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value })}
          className={field}
          aria-label="Type"
        >
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
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
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
          value={draft.mode}
          onChange={(e) => setDraft({ ...draft, mode: e.target.value })}
          className={field}
          aria-label="Kind"
        >
          {MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabel}>Date</label>
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          className={`${field} dark:[color-scheme:dark]`}
          aria-label="Date"
        />
      </div>

      <div>
        <label className={fieldLabel}>Time</label>
        <input
          type="time"
          value={draft.time}
          onChange={(e) => setDraft({ ...draft, time: e.target.value })}
          className={`${field} dark:[color-scheme:dark]`}
          aria-label="Time"
        />
      </div>

      {draft.mode === "event" && (
        <>
          <div>
            <label className={fieldLabel}>Ends</label>
            <input
              type="time"
              value={draft.endTime}
              onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              className={`${field} dark:[color-scheme:dark]`}
              aria-label="End time"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={fieldLabel}>Location</label>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              className={field}
              aria-label="Location"
            />
          </div>
        </>
      )}

      <div className="sm:col-span-3">
        <label className={fieldLabel}>Notes</label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className={`${field} resize-none`}
          aria-label="Notes"
        />
      </div>
    </div>

    <div className="flex justify-end gap-2 mt-4">
      <button
        onClick={onCancel}
        className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded-md transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Save
      </button>
    </div>
  </div>
);

const RowActions = ({ item, onEdit, onDelete }) => (
  <span className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
    <button
      onClick={onEdit}
      className="p-1 text-gray-400 hover:text-foreground"
      title="Edit"
      aria-label={`Edit ${item.title}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
        />
      </svg>
    </button>
    <button
      onClick={onDelete}
      className="p-1 text-gray-400 hover:text-destructive"
      title="Delete"
      aria-label={`Delete ${item.title}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  </span>
);

const WorkTracker = ({ user }) => {
  const [spaces, setSpaces] = useState([]);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [spaceFilter, setSpaceFilter] = useState("");
  const [prefs] = useWorkPrefs();

  const itemsPath = user ? `users/${user.uid}/work` : null;

  useEffect(() => {
    if (!user) return;

    const spacesRef = ref(database, `users/${user.uid}/spaces`);
    const unsubscribe = onValue(
      spacesRef,
      (snapshot) => {
        const data = snapshot.val();
        const loaded = data
          ? Object.entries(data).map(([key, value]) => normalizeSpace(key, value))
          : [];
        loaded.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
        setSpaces(loaded);
      },
      (err) => setError(err?.message || "Failed to load classes")
    );

    return () => unsubscribe && unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const workRef = ref(database, `users/${user.uid}/work`);
    const unsubscribe = onValue(
      workRef,
      (snapshot) => {
        const data = snapshot.val();
        setItems(
          data
            ? Object.entries(data).map(([key, value]) => normalizeItem(key, value))
            : []
        );
        setIsLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load work");
        setIsLoading(false);
      }
    );

    return () => unsubscribe && unsubscribe();
  }, [user]);

  const spaceById = useMemo(() => {
    const map = new Map();
    spaces.forEach((space) => map.set(space.id, space));
    return map;
  }, [spaces]);

  const overdueCount = useMemo(
    () =>
      items.filter((item) => !item.done && bucketFor(item) === "overdue").length,
    [items]
  );

  const visible = useMemo(
    () =>
      spaceFilter ? items.filter((item) => item.spaceId === spaceFilter) : items,
    [items, spaceFilter]
  );

  // Everything sorts by when it's due; done and past work sinks to the bottom
  // on its own rather than behind a toggle.
  const groups = useMemo(() => {
    const byBucket = new Map();
    visible.forEach((item) => {
      const bucket = item.done ? "done" : bucketFor(item);
      const list = byBucket.get(bucket) || [];
      list.push(item);
      byBucket.set(bucket, list);
    });

    const ordered = [];
    BUCKETS.forEach((bucket) => {
      const list = byBucket.get(bucket.id);
      if (list && list.length)
        ordered.push({ ...bucket, items: [...list].sort(sortByDate) });
    });

    const done = byBucket.get("done");
    if (done && done.length)
      ordered.push({
        id: "done",
        label: "Done",
        tone: "",
        items: [...done].sort((a, b) => b.completedAt - a.completedAt),
      });

    return ordered;
  }, [visible]);

  const tableRows = useMemo(
    () =>
      [...visible].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return sortByDate(a, b);
      }),
    [visible]
  );

  // A #name the parser couldn't match becomes a new class, colored with the
  // first palette entry nothing else is using.
  const createSpace = async (name) => {
    const used = new Set(spaces.map((space) => space.color));
    const color =
      PALETTE_KEYS.find((key) => !used.has(key)) ||
      PALETTE_KEYS[spaces.length % PALETTE_KEYS.length];

    const newRef = push(ref(database, `users/${user.uid}/spaces`));
    await set(newRef, {
      name: name.trim(),
      kind: "class",
      color,
      teacher: "",
      room: "",
      archived: false,
      order: spaces.length,
      createdAt: Date.now(),
    });
    return newRef.key;
  };

  const handleAdd = async (parsed) => {
    if (!user || parsed.title.trim() === "") return;
    try {
      let spaceId = parsed.spaceId;
      if (!spaceId && parsed.newSpaceName)
        spaceId = await createSpace(parsed.newSpaceName);

      const newRef = push(ref(database, itemsPath));
      await set(newRef, {
        ...payloadFromDraft({ ...parsed, spaceId }),
        done: false,
        createdAt: Date.now(),
        completedAt: 0,
      });
    } catch (err) {
      setError(err?.message || "Failed to add item");
    }
  };

  const handleToggleDone = async (item) => {
    if (!user) return;
    try {
      await update(child(ref(database, itemsPath), item.id), {
        done: !item.done,
        completedAt: item.done ? 0 : Date.now(),
      });
    } catch (err) {
      setError(err?.message || "Failed to update item");
    }
  };

  const handleSaveEdit = async () => {
    if (!user || !editingId || !editDraft) return;
    try {
      await update(
        child(ref(database, itemsPath), editingId),
        payloadFromDraft(editDraft)
      );
      setEditingId(null);
    } catch (err) {
      setError(err?.message || "Failed to save item");
    }
  };

  const handleDelete = async (item) => {
    if (!user) return;
    try {
      await remove(child(ref(database, itemsPath), item.id));
      if (editingId === item.id) setEditingId(null);
    } catch (err) {
      setError(err?.message || "Failed to delete item");
    }
  };

  const startEdit = (item) => {
    setEditDraft(draftFromItem(item));
    setEditingId(item.id);
  };

  const activeSpaces = spaces.filter((space) => !space.archived);
  const filterName = spaceById.get(spaceFilter)?.name;

  const Checkbox = ({ item }) =>
    item.when.mode === "event" ? (
      <span
        className="h-4 w-4 flex-shrink-0 flex items-center justify-center text-gray-300 dark:text-gray-600"
        title="Event"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </span>
    ) : (
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => handleToggleDone(item)}
        className="h-4 w-4 flex-shrink-0 text-primary focus:ring-ring border-border rounded cursor-pointer dark:bg-gray-700"
        aria-label={`Mark ${item.title} as ${item.done ? "not done" : "done"}`}
      />
    );

  const editRow = (item) => (
    <EditPanel
      draft={editDraft}
      setDraft={setEditDraft}
      spaces={activeSpaces}
      onSave={handleSaveEdit}
      onCancel={() => setEditingId(null)}
    />
  );

  return (
    <div className="max-w-4xl mx-auto bg-card shadow rounded-md p-6 transition-colors duration-200">
      <div className="flex items-baseline justify-between pb-4">
        <h2 className="text-xl font-semibold text-foreground">
          work
        </h2>
        {overdueCount > 0 && (
          <span className="text-sm text-destructive">
            {overdueCount} overdue
          </span>
        )}
      </div>

      <QuickAdd spaces={activeSpaces} onSubmit={handleAdd} />

      {filterName && (
        <button
          onClick={() => setSpaceFilter("")}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground"
        >
          {filterName} ✕
        </button>
      )}

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
          {items.length === 0 ? "nothing tracked yet." : "nothing here."}
        </div>
      )}

      {/* Table view */}
      {!isLoading && prefs.table && visible.length > 0 && (
        <div className="mt-6 overflow-x-auto">
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
              {tableRows.map((item) => {
                const space = spaceById.get(item.spaceId);
                const priority = priorityOf(item.priority);
                const isOverdue = !item.done && bucketFor(item) === "overdue";

                if (editingId === item.id) {
                  return (
                    <tr key={item.id}>
                      <td colSpan={7} className="py-3">
                        {editRow(item)}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={item.id}
                    className="group border-b border-border/60 hover:bg-muted/40/40 transition-colors"
                  >
                    <td className="py-2 align-middle">
                      <Checkbox item={item} />
                    </td>
                    <td
                      className={`py-2 pr-3 ${
                        item.done
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </td>
                    <td
                      className={`py-2 px-3 whitespace-nowrap ${
                        isOverdue
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatWhen(item)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`${tag} ${
                          prefs.colors ? typeChip(item.type) : NEUTRAL_CHIP
                        }`}
                      >
                        {typeLabel(item.type)}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {space && (
                        <button
                          onClick={() => setSpaceFilter(space.id)}
                          className={`${tag} ${
                            prefs.colors
                              ? colorOf(space.color).chip
                              : NEUTRAL_CHIP
                          }`}
                        >
                          {space.name}
                        </button>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`${tag} ${
                          prefs.colors || item.priority === "insane"
                            ? priority.chip
                            : NEUTRAL_CHIP
                        }`}
                      >
                        {priority.label}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <RowActions
                        item={item}
                        onEdit={() => startEdit(item)}
                        onDelete={() => handleDelete(item)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Grouped list view */}
      {!isLoading && !prefs.table && (
        <div className="mt-2">
          {groups.map((group) => (
            <div key={group.id} className="mt-5 first:mt-3">
              <div
                className={`text-xs ${
                  group.tone || "text-muted-foreground"
                }`}
              >
                {group.label}
              </div>

              <ul className="divide-y divide-border">
                {group.items.map((item) => {
                  const space = spaceById.get(item.spaceId);
                  const isOverdue = !item.done && bucketFor(item) === "overdue";

                  if (editingId === item.id) {
                    return (
                      <li key={item.id} className="py-3">
                        {editRow(item)}
                      </li>
                    );
                  }

                  return (
                    <li
                      key={item.id}
                      className="group flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox item={item} />

                        {prefs.colors && space && (
                          <span
                            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                              colorOf(space.color).dot
                            } ${item.done ? "opacity-30" : ""}`}
                            title={space.name}
                          />
                        )}

                        <span
                          className={`truncate ${
                            item.done
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {item.title}
                        </span>

                        {item.priority === "insane" && !item.done && (
                          <span className="text-xs font-bold text-destructive flex-shrink-0">
                            INSANE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
                          {space && (
                            <button
                              onClick={() => setSpaceFilter(space.id)}
                              className="hover:text-foreground transition-colors"
                            >
                              {space.name}
                            </button>
                          )}
                          <span>{typeLabel(item.type)}</span>
                          <span
                            className={
                              isOverdue ? "text-destructive" : ""
                            }
                          >
                            {formatWhen(item)}
                          </span>
                        </span>

                        <RowActions
                          item={item}
                          onEdit={() => startEdit(item)}
                          onDelete={() => handleDelete(item)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkTracker;
