import { ref, get, update } from "firebase/database";
import { classify, previewCleanup, runCleanup } from "./cleanupSynced";
import { normalizeItem } from "../constants/work";

const user = { uid: "u1" };

const row = (overrides) =>
  normalizeItem(overrides.id, {
    title: "Thing",
    spaceId: "",
    type: "",
    priority: "medium",
    when: { mode: "event", date: "2026-09-09", time: "", endTime: "" },
    ...overrides,
  });

beforeEach(() => {
  ref.mockImplementation((db, path) => ({ path: path || "" }));
  update.mockResolvedValue();
});

describe("deciding what was yours", () => {
  it("keeps anything filed under a class", () => {
    const { keep, noise, copies } = classify([
      row({ id: "a", title: "PSET 3", spaceId: "physics", type: "hw" }),
      row({ id: "b", title: "Activity Fair", spaceId: "ict", type: "other" }),
    ]);

    expect(keep.map((item) => item.id)).toEqual(["a", "b"]);
    expect(noise).toHaveLength(0);
    expect(copies).toHaveLength(0);
  });

  it("treats a row with no class and no type as calendar noise", () => {
    const { noise } = classify([
      row({ id: "a", title: "Z's peanut challenge" }),
      row({ id: "b", title: "Adam's birthday" }),
      row({ id: "c", title: "Zain : Mr. Osman USACO" }),
    ]);

    expect(noise.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("drops the class-less twin of an assignment you filed", () => {
    const { keep, copies } = classify([
      row({ id: "real", title: "PSET 3", spaceId: "physics", type: "hw" }),
      row({ id: "twin", title: "PSET 3", type: "hw" }),
    ]);

    expect(keep.map((item) => item.id)).toEqual(["real"]);
    expect(copies.map((item) => item.id)).toEqual(["twin"]);
  });

  it("keeps a typed row that has no filed counterpart", () => {
    // Losing this would be losing the only record of it.
    const { keep, copies } = classify([
      row({ id: "lonely", title: "Read chapter 4", type: "reading" }),
    ]);

    expect(keep.map((item) => item.id)).toEqual(["lonely"]);
    expect(copies).toHaveLength(0);
  });

  it("trusts the origin stamp over everything else", () => {
    const { noise } = classify([
      row({ id: "g", title: "Standup", spaceId: "work", origin: "google" }),
    ]);

    expect(noise.map((item) => item.id)).toEqual(["g"]);
  });
});

describe("running it", () => {
  const stored = {
    keep1: { title: "PSET 3", spaceId: "physics", type: "hw", when: {} },
    junk1: { title: "Z's peanut challenge", when: {} },
    junk2: { title: "Adam's birthday", when: {} },
    twin1: { title: "PSET 3", type: "hw", when: {} },
  };

  beforeEach(() => {
    get.mockResolvedValue({ val: () => stored });
  });

  it("counts without writing anything", async () => {
    const preview = await previewCleanup(user);

    expect(preview).toEqual({ total: 4, keep: 1, noise: 2, copies: 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it("removes each item together with its link, in one write", async () => {
    const result = await runCleanup(user);
    expect(result).toEqual({ removed: 3, kept: 1 });

    expect(update).toHaveBeenCalledTimes(1);
    const [, payload] = update.mock.calls[0];

    // An item outliving its link is what used to make the sync delete the
    // event from Google, so both paths have to go in the same write.
    ["junk1", "junk2", "twin1"].forEach((id) => {
      expect(payload[`users/u1/work/${id}`]).toBeNull();
      expect(payload[`users/u1/googleCalendar/links/${id}`]).toBeNull();
    });

    expect(payload["users/u1/work/keep1"]).toBeUndefined();
    expect(Object.keys(payload)).toHaveLength(6);
  });

  it("writes nothing when there is nothing to remove", async () => {
    get.mockResolvedValue({
      val: () => ({ a: { title: "PSET 3", spaceId: "physics", when: {} } }),
    });

    const result = await runCleanup(user);
    expect(result).toEqual({ removed: 0, kept: 1 });
    expect(update).not.toHaveBeenCalled();
  });
});
