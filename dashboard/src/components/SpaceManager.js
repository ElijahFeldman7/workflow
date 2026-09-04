import React, { useState, useMemo } from "react";
import { database } from "../firebase";
import { useWorkData } from "../lib/useWorkData";
import { IconButton, PencilIcon, TrashIcon, ArchiveIcon } from "./Icons";
import { ref, push, set, update, remove, child } from "firebase/database";
import {
  PALETTE_ENTRIES,
  SPACE_KINDS,
  DEFAULT_COLOR,
  DEFAULT_SPACE_KIND,
  bucketFor,
  colorOf,
} from "../constants/work";

const blankDraft = () => ({
  name: "",
  kind: DEFAULT_SPACE_KIND,
  color: DEFAULT_COLOR,
  teacher: "",
  room: "",
});

const ColorPicker = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {PALETTE_ENTRIES.map(([key, color]) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        title={color.label}
        aria-label={`Color ${color.label}`}
        aria-pressed={value === key}
        className={`h-6 w-6 rounded-full ${color.swatch} transition-transform hover:scale-110 ${
          value === key
            ? "ring-2 ring-offset-2 ring-gray-500 dark:ring-gray-300 dark:ring-offset-gray-800"
            : ""
        }`}
      />
    ))}
  </div>
);

const SpaceForm = ({ draft, setDraft, onSave, onCancel, saveLabel }) => (
  <div className="p-4 rounded-md border border-dashed border-border bg-muted/40">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
          Name
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="AP Biology, Computer Team, ..."
          className="w-full mt-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Space name"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
          Kind
        </label>
        <select
          value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
          className="w-full mt-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Space kind"
        >
          {SPACE_KINDS.map((kind) => (
            <option key={kind.id} value={kind.id}>
              {kind.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
          {draft.kind === "class" ? "Teacher" : "Lead / Advisor"}
        </label>
        <input
          type="text"
          value={draft.teacher}
          onChange={(e) => setDraft({ ...draft, teacher: e.target.value })}
          className="w-full mt-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Teacher or lead"
        />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
          Room
        </label>
        <input
          type="text"
          value={draft.room}
          onChange={(e) => setDraft({ ...draft, room: e.target.value })}
          className="w-full mt-1 border border-border rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
          aria-label="Room"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block mb-2">
          Color
        </label>
        <ColorPicker
          value={draft.color}
          onChange={(color) => setDraft({ ...draft, color })}
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
        disabled={draft.name.trim() === ""}
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saveLabel}
      </button>
    </div>
  </div>
);

const SpaceManager = ({ user }) => {
  const { spaces, items, error, setError } = useWorkData(user);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(blankDraft);
  const [showArchived, setShowArchived] = useState(false);

  const spacesPath = user ? `users/${user.uid}/spaces` : null;

  // Item counts per class, for the "3 open · 1 overdue" line on each card.
  const counts = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      if (!item.spaceId) return;
      const entry = map.get(item.spaceId) || { total: 0, open: 0, overdue: 0 };
      entry.total += 1;
      if (!item.done) {
        entry.open += 1;
        if (bucketFor(item) === "overdue") entry.overdue += 1;
      }
      map.set(item.spaceId, entry);
    });
    return map;
  }, [items]);

  const startAdding = () => {
    setDraft(blankDraft());
    setEditingId(null);
    setIsAdding(true);
  };

  const startEditing = (space) => {
    setDraft({
      name: space.name,
      kind: space.kind,
      color: space.color,
      teacher: space.teacher,
      room: space.room,
    });
    setIsAdding(false);
    setEditingId(space.id);
  };

  const closeForms = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!user || draft.name.trim() === "") return;
    try {
      const newRef = push(ref(database, spacesPath));
      await set(newRef, {
        name: draft.name.trim(),
        kind: draft.kind,
        color: draft.color,
        teacher: draft.teacher.trim(),
        room: draft.room.trim(),
        archived: false,
        order: spaces.length,
        createdAt: Date.now(),
      });
      closeForms();
    } catch (err) {
      setError(err?.message || "Failed to create space");
    }
  };

  const handleUpdate = async () => {
    if (!user || !editingId || draft.name.trim() === "") return;
    try {
      await update(child(ref(database, spacesPath), editingId), {
        name: draft.name.trim(),
        kind: draft.kind,
        color: draft.color,
        teacher: draft.teacher.trim(),
        room: draft.room.trim(),
      });
      closeForms();
    } catch (err) {
      setError(err?.message || "Failed to update space");
    }
  };

  const handleArchive = async (space) => {
    if (!user) return;
    try {
      await update(child(ref(database, spacesPath), space.id), {
        archived: !space.archived,
      });
    } catch (err) {
      setError(err?.message || "Failed to archive space");
    }
  };

  const handleDelete = async (space) => {
    if (!user) return;
    const count = counts.get(space.id)?.total || 0;
    const warning =
      count > 0
        ? `Delete "${space.name}"? Its ${count} item${
            count === 1 ? "" : "s"
          } will stay, but lose their color and grouping. Archiving keeps them intact.`
        : `Delete "${space.name}"?`;
    if (!window.confirm(warning)) return;

    try {
      await remove(child(ref(database, spacesPath), space.id));
      if (editingId === space.id) closeForms();
    } catch (err) {
      setError(err?.message || "Failed to delete space");
    }
  };

  const visible = spaces.filter((space) => showArchived || !space.archived);
  const archivedCount = spaces.filter((space) => space.archived).length;

  return (
    <div className="bg-card shadow rounded-md p-6 transition-colors duration-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-foreground">
          Classes &amp; Activities
        </h2>
        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
            >
              {showArchived ? "Hide" : "Show"} archived ({archivedCount})
            </button>
          )}
          {!isAdding && (
            <button
              onClick={startAdding}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
            >
              Add
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
          {error}
        </div>
      )}

      {isAdding && (
        <div className="mb-4">
          <SpaceForm
            draft={draft}
            setDraft={setDraft}
            onSave={handleCreate}
            onCancel={closeForms}
            saveLabel="Create"
          />
        </div>
      )}

      {visible.length === 0 && !isAdding && (
        <div className="text-muted-foreground text-center py-8 bg-muted/40 rounded-md border border-dashed border-border text-sm">
          No classes or activities yet. Add one to start color-coding your work.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((space) => {
          const color = colorOf(space.color);
          const stats = counts.get(space.id) || { open: 0, overdue: 0 };

          if (editingId === space.id) {
            return (
              <div key={space.id} className="sm:col-span-2 lg:col-span-3">
                <SpaceForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={handleUpdate}
                  onCancel={closeForms}
                  saveLabel="Save"
                />
              </div>
            );
          }

          return (
            <div
              key={space.id}
              className={`group relative border-l-4 ${color.bar} border border-border rounded-md p-3 ${
                space.archived ? "opacity-50" : ""
              } hover:border-gray-300 dark:hover:border-gray-600 transition-colors`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${color.dot} flex-shrink-0`}
                    />
                    <span className="font-medium text-foreground truncate">
                      {space.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {[
                      SPACE_KINDS.find((k) => k.id === space.kind)?.label,
                      space.teacher,
                      space.room,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="text-xs mt-2 flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {stats.open} open
                    </span>
                    {stats.overdue > 0 && (
                      <span className="text-destructive font-medium">
                        {stats.overdue} overdue
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <IconButton
                    onClick={() => startEditing(space)}
                    title="Edit"
                    label={`Edit ${space.name}`}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleArchive(space)}
                    title={space.archived ? "Unarchive" : "Archive"}
                    label={`${space.archived ? "Unarchive" : "Archive"} ${
                      space.name
                    }`}
                  >
                    <ArchiveIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(space)}
                    danger
                    title="Delete"
                    label={`Delete ${space.name}`}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpaceManager;
