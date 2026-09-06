import { useCallback } from "react";
import { ref, push, update } from "firebase/database";
import { database } from "../firebase";
import { normalizeItem } from "../constants/work";

// Pasting a calendar file creates work items, which is a deliberate act by the
// person doing it. It lives here rather than in the sync so that the sync can
// be shown to have no path to the work list at all.

const workPath = (uid) => `users/${uid}/work`;

export function useIcsImport(user) {
  return useCallback(
    async (parsed) => {
      if (!user || parsed.length === 0) return 0;

      const updates = {};
      parsed.forEach((entry) => {
        const newRef = push(ref(database, workPath(user.uid)));
        const record = normalizeItem(newRef.key, {
          ...entry,
          spaceId: "",
          createdAt: Date.now(),
          completedAt: 0,
        });
        updates[newRef.key] = {
          title: record.title,
          spaceId: "",
          type: record.type,
          priority: record.priority,
          location: record.location,
          notes: record.notes,
          when: record.when,
          done: false,
          createdAt: record.createdAt,
          completedAt: 0,
        };
      });

      await update(ref(database, workPath(user.uid)), updates);
      return parsed.length;
    },
    [user]
  );
}
