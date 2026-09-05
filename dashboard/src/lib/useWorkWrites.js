import { useCallback, useState } from "react";
import { ref, push, set, update, remove, child } from "firebase/database";
import { database } from "../firebase";
import { PALETTE_KEYS } from "../constants/work";

/**
 * Every write the work items need, shared by the work list and the calendar so
 * the two behave identically.
 *
 * `isDone` reads through an optimistic map so a ticked row flips the moment
 * you click it rather than after the Firebase round-trip.
 */
export function useWorkWrites(user, spaces, onError) {
  const [pending, setPending] = useState(() => new Map());

  const itemsPath = user ? `users/${user.uid}/work` : null;

  const fail = useCallback(
    (err, fallback) => {
      if (onError) onError(err?.message || fallback);
    },
    [onError]
  );

  const patch = useCallback(
    async (item, changes) => {
      if (!user) return false;
      try {
        await update(child(ref(database, itemsPath), item.id), changes);
        return true;
      } catch (err) {
        fail(err, "Failed to save");
        return false;
      }
    },
    [user, itemsPath, fail]
  );

  const isDone = useCallback(
    (item) => (pending.has(item.id) ? pending.get(item.id) : item.done),
    [pending]
  );

  const toggleDone = useCallback(
    async (item) => {
      const next = !(pending.has(item.id) ? pending.get(item.id) : item.done);
      setPending((prev) => new Map(prev).set(item.id, next));

      const saved = await patch(item, {
        done: next,
        completedAt: next ? Date.now() : 0,
      });

      // Drop the optimistic value if the write didn't land, so the row goes
      // back to whatever Firebase actually holds.
      if (!saved) {
        setPending((prev) => {
          const rest = new Map(prev);
          rest.delete(item.id);
          return rest;
        });
      }
    },
    [pending, patch]
  );

  const deleteItem = useCallback(
    async (item) => {
      if (!user) return;
      try {
        await remove(child(ref(database, itemsPath), item.id));
      } catch (err) {
        fail(err, "Failed to delete item");
      }
    },
    [user, itemsPath, fail]
  );

  // A #name the parser couldn't match becomes a new class, colored with the
  // first palette entry nothing else is using.
  const createSpace = useCallback(
    async (name) => {
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
    },
    [user, spaces]
  );

  const addItem = useCallback(
    async (parsed) => {
      if (!user || parsed.title.trim() === "") return;
      try {
        let spaceId = parsed.spaceId;
        if (!spaceId && parsed.newSpaceName)
          spaceId = await createSpace(parsed.newSpaceName);

        const newRef = push(ref(database, itemsPath));
        await set(newRef, {
          title: parsed.title.trim(),
          spaceId: spaceId || "",
          type: parsed.type,
          priority: parsed.priority,
          location: parsed.location || "",
          notes: "",
          when: {
            mode: parsed.mode,
            date: parsed.date || "",
            time: parsed.time || "",
            endTime: parsed.mode === "event" ? parsed.endTime || "" : "",
          },
          done: false,
          createdAt: Date.now(),
          completedAt: 0,
        });
      } catch (err) {
        fail(err, "Failed to add item");
      }
    },
    [user, itemsPath, createSpace, fail]
  );

  return { patch, isDone, toggleDone, deleteItem, addItem };
}
