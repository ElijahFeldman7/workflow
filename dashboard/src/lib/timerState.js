export const DEFAULT_WORK_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

export const emptyTimer = () => ({
  mode: "work",
  remaining: DEFAULT_WORK_MINUTES * 60,
  running: false,
  startedAt: 0,
  workDuration: DEFAULT_WORK_MINUTES,
  breakDuration: DEFAULT_BREAK_MINUTES,
  stats: { work: 0, break: 0 },
  position: { x: 0, y: 0 },
  updatedAt: 0,
});

const count = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const minutes = (value, fallback) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 && number <= 24 * 60
    ? number
    : fallback;
};

export const durationOf = (state, mode = state.mode) =>
  (mode === "break" ? state.breakDuration : state.workDuration) * 60;

export function normalizeTimer(raw) {
  const base = emptyTimer();
  if (!raw || typeof raw !== "object") return base;

  const mode = raw.mode === "break" ? "break" : "work";
  const workDuration = minutes(raw.workDuration, base.workDuration);
  const breakDuration = minutes(raw.breakDuration, base.breakDuration);
  const full = (mode === "break" ? breakDuration : workDuration) * 60;

  return {
    mode,
    // `timeRemaining` is the shape older saves used.
    remaining: Math.min(
      count(raw.remaining !== undefined ? raw.remaining : raw.timeRemaining, full),
      24 * 60 * 60
    ),
    running: raw.running === true,
    startedAt: count(raw.startedAt),
    workDuration,
    breakDuration,
    stats: {
      work: count(raw.stats && raw.stats.work),
      break: count(raw.stats && raw.stats.break),
    },
    position: {
      x: Number.isFinite(Number(raw.position && raw.position.x))
        ? Number(raw.position.x)
        : 0,
      y: Number.isFinite(Number(raw.position && raw.position.y))
        ? Number(raw.position.y)
        : 0,
    },
    updatedAt: count(raw.updatedAt),
  };
}

// Seconds burned since the clock was last anchored, never counting past zero —
// a tab left closed overnight must not book eight hours of study time.
export function elapsedOf(state, at = Date.now()) {
  if (!state.running || !state.startedAt) return 0;
  const seconds = Math.floor((at - state.startedAt) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, state.remaining);
}

export const remainingOf = (state, at = Date.now()) =>
  Math.max(0, state.remaining - elapsedOf(state, at));

export function statsOf(state, at = Date.now()) {
  const spent = elapsedOf(state, at);
  return { ...state.stats, [state.mode]: state.stats[state.mode] + spent };
}

// Bank the time that has run since the last anchor and re-anchor the clock, so
// every write records an absolute truth rather than a drifting countdown.
export function foldTimer(state, at = Date.now()) {
  const spent = elapsedOf(state, at);
  if (spent === 0 && (!state.running || state.startedAt === at)) return state;

  return {
    ...state,
    remaining: state.remaining - spent,
    stats: { ...state.stats, [state.mode]: state.stats[state.mode] + spent },
    startedAt: state.running ? at : 0,
  };
}
