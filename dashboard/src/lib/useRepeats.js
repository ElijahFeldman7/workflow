import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ref, onValue, push, set, update } from "firebase/database";
import { database } from "../firebase";
import { taskRecord } from "../constants/task";
import { DEFAULT_PRIORITY, addDaysKey, todayKey } from "../constants/work";
import { normalizeRepeat, repeatTaskId, repeatsDue } from "./planner";

// To-dos that come round again: change the sheets every Sunday.
//
// A repeat is a rule, and each day it falls on gets an ordinary to-do made for
// it. That to-do's key is built from the rule and the date, so two devices
// making it at the same moment write the same row rather than two.

const repeatsPath = (uid) => `users/${uid}/repeats`;
const tasksPath = (uid) => `users/${uid}/tasks`;

/**
 * @param tasks      every task, including hidden ones, to know what exists
 * @param ready      false until tasks have loaded; nothing is made before then
 * @param dateKeys   the days on screen
 */
export function useRepeats(user, { tasks, ready, dateKeys, onError }) {
  const [raw, setRaw] = useState(null);
  // Made this session, so a slow echo from the database is not a reason to
  // write the same row again.
  const made = useRef(new Set());

  useEffect(() => {
    if (!user) return undefined;
    return onValue(
      ref(database, repeatsPath(user.uid)),
      (snapshot) => setRaw(snapshot.val()),
      () => setRaw(null)
    );
  }, [user]);

  const repeats = useMemo(
    () =>
      raw
        ? Object.entries(raw).map(([id, value]) => normalizeRepeat(id, value))
        : [],
    [raw]
  );

  const repeatById = useMemo(
    () => new Map(repeats.map((repeat) => [repeat.id, repeat])),
    [repeats]
  );

  const visibleKey = dateKeys.join(",");

  useEffect(() => {
    if (!user || !ready || repeats.length === 0) return;

    const today = todayKey();
    const existing = new Set(tasks.map((task) => task.id));
    const updates = {};

    visibleKey
      .split(",")
      .filter((dateKey) => dateKey && dateKey >= today)
      .forEach((dateKey) => {
        repeatsDue(repeats, dateKey).forEach((repeat) => {
          const key = repeatTaskId(repeat.id, dateKey);
          // Never over an existing row: that would undo a tick or a skip.
          if (existing.has(key) || made.current.has(key)) return;
          made.current.add(key);
          updates[key] = {
            ...taskRecord({
              title: repeat.title,
              priority: DEFAULT_PRIORITY,
              mode: "due",
            }),
            plan: { date: dateKey, time: repeat.time, minutes: repeat.minutes },
            repeatId: repeat.id,
          };
        });
      });

    if (Object.keys(updates).length === 0) return;
    update(ref(database, tasksPath(user.uid)), updates).catch((err) => {
      Object.keys(updates).forEach((key) => made.current.delete(key));
      if (onError) onError(err?.message || "Could not add repeating to-dos");
    });
  }, [user, ready, repeats, tasks, visibleKey, onError]);

  /** Starts a repeat from a to-do, or changes the days of the one it has. */
  const saveRepeat = useCallback(
    async (task, weekdays) => {
      if (!user) return;
      try {
        if (task.repeatId && repeatById.has(task.repeatId)) {
          await update(
            ref(database, `${repeatsPath(user.uid)}/${task.repeatId}`),
            { weekdays }
          );
          return;
        }

        const newRef = push(ref(database, repeatsPath(user.uid)));
        await set(newRef, {
          title: task.title,
          weekdays,
          time: task.plan.time,
          minutes: task.plan.minutes,
          // This to-do stands for its own day, so the rule starts the day after.
          from: addDaysKey(task.plan.date || todayKey(), 1),
          createdAt: Date.now(),
        });
        await update(ref(database, `${tasksPath(user.uid)}/${task.id}`), {
          repeatId: newRef.key,
        });
      } catch (err) {
        if (onError) onError(err?.message || "Could not save the repeat");
      }
    },
    [user, repeatById, onError]
  );

  /** Ends a repeat. What is done or already past stays as it was. */
  const stopRepeat = useCallback(
    async (repeatId) => {
      if (!user || !repeatId) return;
      const today = todayKey();
      const updates = { [`${repeatsPath(user.uid)}/${repeatId}`]: null };

      tasks.forEach((task) => {
        if (task.repeatId !== repeatId) return;
        const path = `${tasksPath(user.uid)}/${task.id}`;
        if (!task.done && task.plan.date > today && task.id.startsWith("rep_"))
          updates[path] = null;
        else updates[`${path}/repeatId`] = null;
      });

      try {
        await update(ref(database), updates);
      } catch (err) {
        if (onError) onError(err?.message || "Could not stop the repeat");
      }
    },
    [user, tasks, onError]
  );

  return { repeats, repeatById, saveRepeat, stopRepeat };
}
