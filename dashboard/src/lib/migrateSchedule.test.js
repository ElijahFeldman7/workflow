import { ref, get, push, update } from "firebase/database";
import { migrateSchedule } from "./migrateSchedule";

const user = { uid: "u1" };

const snapshot = (value) => ({
  exists: () => value !== null && value !== undefined,
  val: () => value,
});

// get() is called twice: once for the migrated flag, once for schedule/.
const mockReads = ({ flag = null, schedule = null }) => {
  get.mockImplementation((reference) =>
    Promise.resolve(
      String(reference).includes("scheduleMigratedAt")
        ? snapshot(flag)
        : snapshot(schedule)
    )
  );
};

beforeEach(() => {
  ref.mockImplementation((db, path) => ({ toString: () => path }));
  update.mockResolvedValue(undefined);

  let n = 0;
  push.mockImplementation(() => {
    n += 1;
    return { key: `new${n}`, toString: () => `new${n}` };
  });
});

/** The rows the migration wrote to work/. */
const writtenRows = () => {
  const call = update.mock.calls.find(([reference]) =>
    String(reference).endsWith("/work")
  );
  return call ? Object.values(call[1]) : [];
};

const byTitle = (rows, title) => rows.find((row) => row.title === title);

test("turns each filled hour slot into a timed event", async () => {
  mockReads({
    schedule: {
      "2026-09-11": {
        "9_00_AM": "physics lab",
        "3_00_PM": "activity fair",
        "4_00_PM": "   ", // blank after trimming, skipped
      },
      "2026-09-12": { "12_00_PM": "lunch meeting" },
    },
  });

  const result = await migrateSchedule(user);
  expect(result).toEqual({ status: "done", created: 3 });

  const rows = writtenRows();
  expect(rows).toHaveLength(3);

  const fair = byTitle(rows, "activity fair");
  expect(fair.when).toEqual({
    mode: "event",
    date: "2026-09-11",
    time: "15:00",
    endTime: "",
  });
  expect(fair.done).toBe(false);

  expect(byTitle(rows, "physics lab").when.time).toBe("09:00");
  expect(byTitle(rows, "lunch meeting").when.time).toBe("12:00");
});

test("midnight and noon convert the right way round", async () => {
  mockReads({
    schedule: {
      "2026-09-11": { "12_00_AM": "midnight", "12_00_PM": "noon" },
    },
  });

  await migrateSchedule(user);

  const rows = writtenRows();
  expect(byTitle(rows, "midnight").when.time).toBe("00:00");
  expect(byTitle(rows, "noon").when.time).toBe("12:00");
});

test("ignores malformed days and hour keys", async () => {
  mockReads({
    schedule: {
      "not-a-date": { "9_00_AM": "nope" },
      "2026-09-11": { "25_00_PM": "nope", weird: "nope", "9_30_AM": "nope" },
    },
  });

  const result = await migrateSchedule(user);
  expect(result).toEqual({ status: "done", created: 0 });
  // Nothing to write, so only the flag is set.
  expect(writtenRows()).toHaveLength(0);
});

test("does not run twice", async () => {
  mockReads({ flag: 1, schedule: { "2026-09-11": { "9_00_AM": "x" } } });

  const result = await migrateSchedule(user);
  expect(result).toEqual({ status: "already" });
  expect(update).not.toHaveBeenCalled();
});

test("flags an empty schedule so it stops re-reading it", async () => {
  mockReads({ schedule: null });

  const result = await migrateSchedule(user);
  expect(result).toEqual({ status: "empty" });
  expect(update).toHaveBeenCalledTimes(1);
});
