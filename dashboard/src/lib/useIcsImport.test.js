import { renderHook } from "@testing-library/react";
import { ref, get, push, update } from "firebase/database";
import { useIcsImport } from "./useIcsImport";

const user = { uid: "u1" };

const entry = (overrides = {}) => ({
  icsUid: "abc|2026-09-09|",
  title: "Activity Fair",
  notes: "",
  location: "",
  when: { mode: "event", date: "2026-09-09", time: "", endTime: "" },
  type: "",
  priority: "medium",
  done: false,
  ...overrides,
});

let stored;
let nextKey;

const run = (parsed) => {
  const { result } = renderHook(() => useIcsImport(user));
  return result.current(parsed);
};

beforeEach(() => {
  stored = null;
  nextKey = 0;
  ref.mockImplementation((db, path) => ({ path: path || "" }));
  get.mockImplementation(() => Promise.resolve({ val: () => stored }));
  push.mockImplementation(() => {
    nextKey += 1;
    return { key: `k${nextKey}` };
  });
  update.mockResolvedValue();
});

test("an import keeps the id it was matched on", async () => {
  await expect(run([entry()])).resolves.toBe(1);

  const [, payload] = update.mock.calls[0];
  expect(payload.k1).toMatchObject({
    title: "Activity Fair",
    icsUid: "abc|2026-09-09|",
  });
});

test("importing the same file twice adds nothing the second time", async () => {
  stored = { old: { title: "Activity Fair", icsUid: "abc|2026-09-09|", when: {} } };

  await expect(run([entry()])).resolves.toBe(0);
  expect(update).not.toHaveBeenCalled();
});

test("a row imported before ids were kept is matched by what it says", async () => {
  stored = {
    old: {
      title: "activity fair ",
      when: { mode: "event", date: "2026-09-09", time: "" },
    },
  };

  await expect(run([entry()])).resolves.toBe(0);
});

test("the same event listed twice in one file lands once", async () => {
  await expect(run([entry(), entry()])).resolves.toBe(1);
});

test("a different day of the same series still comes in", async () => {
  stored = { old: { title: "Club", icsUid: "s|2026-09-10|14:30", when: {} } };

  const next = entry({
    icsUid: "s|2026-09-17|14:30",
    title: "Club",
    when: { mode: "event", date: "2026-09-17", time: "14:30", endTime: "" },
  });
  await expect(run([next])).resolves.toBe(1);
});
