import {
  durationOf,
  elapsedOf,
  emptyTimer,
  foldTimer,
  normalizeTimer,
  remainingOf,
  statsOf,
} from "./timerState";

const running = (overrides = {}) => ({
  ...emptyTimer(),
  running: true,
  startedAt: 1000,
  ...overrides,
});

describe("normalizeTimer", () => {
  it("falls back to a fresh timer for junk", () => {
    expect(normalizeTimer(null)).toEqual(emptyTimer());
    expect(normalizeTimer("nope")).toEqual(emptyTimer());
    expect(normalizeTimer({ mode: 42, stats: "x" })).toEqual(emptyTimer());
  });

  it("reads the older timeRemaining shape", () => {
    expect(normalizeTimer({ timeRemaining: 600 }).remaining).toBe(600);
  });

  it("keeps everything a session needs", () => {
    const saved = normalizeTimer({
      mode: "break",
      remaining: 120,
      running: true,
      startedAt: 5000,
      workDuration: 50,
      breakDuration: 10,
      stats: { work: 900, break: 60 },
      position: { x: -30, y: 12 },
      updatedAt: 7,
    });

    expect(saved).toEqual({
      mode: "break",
      remaining: 120,
      running: true,
      startedAt: 5000,
      workDuration: 50,
      breakDuration: 10,
      stats: { work: 900, break: 60 },
      position: { x: -30, y: 12 },
      updatedAt: 7,
    });
  });

  it("rejects a duration that is not a sane number of minutes", () => {
    expect(normalizeTimer({ workDuration: 0 }).workDuration).toBe(25);
    expect(normalizeTimer({ workDuration: -5 }).workDuration).toBe(25);
    expect(normalizeTimer({ breakDuration: 99999 }).breakDuration).toBe(5);
  });
});

describe("a running clock is derived from when it started", () => {
  it("counts down in real time", () => {
    const state = running({ remaining: 300 });
    expect(remainingOf(state, 1000)).toBe(300);
    expect(remainingOf(state, 91000)).toBe(210);
  });

  it("does not run past zero, however long the tab was gone", () => {
    const state = running({ remaining: 60 });
    expect(remainingOf(state, 1000 + 8 * 3600 * 1000)).toBe(0);
    expect(elapsedOf(state, 1000 + 8 * 3600 * 1000)).toBe(60);
  });

  it("credits the time studied to the mode that ran", () => {
    const state = running({ mode: "break", remaining: 300, stats: { work: 10, break: 4 } });
    expect(statsOf(state, 61000)).toEqual({ work: 10, break: 64 });
  });

  it("a paused clock neither counts down nor banks time", () => {
    const state = { ...emptyTimer(), remaining: 300, stats: { work: 10, break: 0 } };
    expect(remainingOf(state, Date.now())).toBe(300);
    expect(statsOf(state, Date.now())).toEqual({ work: 10, break: 0 });
  });
});

describe("foldTimer", () => {
  it("banks elapsed time and re-anchors, leaving the total unchanged", () => {
    const folded = foldTimer(running({ remaining: 300, stats: { work: 5, break: 0 } }), 61000);
    expect(folded.remaining).toBe(240);
    expect(folded.stats).toEqual({ work: 65, break: 0 });
    expect(folded.startedAt).toBe(61000);
    expect(remainingOf(folded, 61000)).toBe(240);
  });

  it("folding twice does not double count", () => {
    const once = foldTimer(running({ remaining: 300 }), 61000);
    const twice = foldTimer(once, 61000);
    expect(twice.remaining).toBe(240);
    expect(twice.stats.work).toBe(60);
  });

  it("leaves a paused timer alone", () => {
    const paused = { ...emptyTimer(), remaining: 300 };
    expect(foldTimer(paused, 99999)).toBe(paused);
  });
});

describe("durationOf", () => {
  it("reads the interval for a mode in seconds", () => {
    const state = { ...emptyTimer(), workDuration: 50, breakDuration: 10 };
    expect(durationOf(state)).toBe(3000);
    expect(durationOf(state, "break")).toBe(600);
  });
});
