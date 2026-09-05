import { ref, get, push, update } from "firebase/database";
import { database } from "../firebase";
import { isDateKey } from "../constants/work";

const MIGRATED_FLAG = "scheduleMigratedAt";

function hourKeyToTime(key) {
  const match = /^(\d{1,2})_00_(AM|PM)$/.exec(key);
  if (!match) return null;

  let hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  if (match[2] === "PM" && hour !== 12) hour += 12;
  if (match[2] === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:00`;
}

export async function migrateSchedule(user) {
  if (!user) return { status: "skipped" };

  const flagSnap = await get(
    ref(database, `users/${user.uid}/${MIGRATED_FLAG}`)
  );
  if (flagSnap.exists()) return { status: "already" };

  const scheduleSnap = await get(ref(database, `users/${user.uid}/schedule`));
  const schedule = scheduleSnap.val();

  if (!schedule) {
    await update(ref(database, `users/${user.uid}`), {
      [MIGRATED_FLAG]: Date.now(),
    });
    return { status: "empty" };
  }

  const writes = {};
  let created = 0;

  Object.entries(schedule).forEach(([dateKey, hours]) => {
    if (!isDateKey(dateKey) || !hours || typeof hours !== "object") return;

    Object.entries(hours).forEach(([hourKey, text]) => {
      const title = typeof text === "string" ? text.trim() : "";
      if (!title) return;

      const time = hourKeyToTime(hourKey);
      if (!time) return;

      const newRef = push(ref(database, `users/${user.uid}/work`));
      writes[newRef.key] = {
        title,
        spaceId: "",
        type: "",
        priority: "medium",
        location: "",
        notes: "",
        when: { mode: "event", date: dateKey, time, endTime: "" },
        done: false,
        createdAt: Date.now(),
        completedAt: 0,
      };
      created += 1;
    });
  });

  if (created > 0) {
    await update(ref(database, `users/${user.uid}/work`), writes);
  }

  await update(ref(database, `users/${user.uid}`), {
    [MIGRATED_FLAG]: Date.now(),
  });

  return { status: "done", created };
}
