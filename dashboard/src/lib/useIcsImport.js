import { useCallback } from "react";
import { ref, get, push, update } from "firebase/database";
import { database } from "../firebase";
import { normalizeItem } from "../constants/work";

// Pasting a calendar file creates work items, which is a deliberate act by the
// person doing it. It lives here rather than in the sync so that the sync can
// be shown to have no path to the work list at all.

const workPath = (uid) => `users/${uid}/work`;

// Rows imported before ids were kept can only be matched by what they say.
const looksLike = (title, when) =>
  `${String(title || "").trim().toLowerCase()}|${when?.date || ""}|${
    when?.time || ""
  }`;

export function useIcsImport(user) {
  return useCallback(
    async (parsed) => {
      if (!user || parsed.length === 0) return 0;

      // Importing the same file twice must not double the list.
      const snapshot = await get(ref(database, workPath(user.uid)));
      const seenIds = new Set();
      const seenLooks = new Set();
      Object.values(snapshot.val() || {}).forEach((row) => {
        if (!row) return;
        if (row.icsUid) seenIds.add(row.icsUid);
        seenLooks.add(looksLike(row.title, row.when));
      });

      const updates = {};
      parsed.forEach((entry) => {
        const looks = looksLike(entry.title, entry.when);
        if ((entry.icsUid && seenIds.has(entry.icsUid)) || seenLooks.has(looks))
          return;
        if (entry.icsUid) seenIds.add(entry.icsUid);
        seenLooks.add(looks);

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
          ...(entry.icsUid ? { icsUid: entry.icsUid } : {}),
        };
      });

      const added = Object.keys(updates).length;
      if (added > 0) await update(ref(database, workPath(user.uid)), updates);
      return added;
    },
    [user]
  );
}
