// FCPS secondary grading handbook. Numerical averages round before the lookup.
export const STUDENTVUE = "https://sisstudent.fcps.edu/";
export const FCPS_SCALE = [
  ["A", 93], ["A-", 90], ["B+", 87], ["B", 83], ["B-", 80],
  ["C+", 77], ["C", 73], ["C-", 70], ["D+", 67], ["D", 60], ["F", 0],
];

export function fcpsLetter(percent) {
  if (!Number.isFinite(percent) || percent < 0) return null;
  const rounded = Math.round(percent);
  return FCPS_SCALE.find(([, minimum]) => rounded >= minimum)?.[0] ?? null;
}

function weightedPercent(categories) {
  const active = categories.filter((category) => category.weight > 0 && category.possible > 0);
  const totalWeight = active.reduce((sum, category) => sum + category.weight, 0);
  if (!totalWeight) return null;
  const ratio = active.reduce((sum, { weight, earned, possible }) =>
    sum + weight * earned / possible, 0) / totalWeight;
  // Remove floating-point noise around an exact FCPS rounding boundary.
  return Number((ratio * 100).toFixed(12));
}

const courseWeights = (course) => course.categories?.length
  ? course.categories
  : [{ name: "", weight: 100 }];

export function projectCourseGrade(course, edits, added = []) {
  const assignments = course.assignments?.filter((assignment) => !assignment.excluded) ?? [];
  const categories = courseWeights(course);
  const weighted = Boolean(course.categories?.length);
  const totals = new Map(categories.map((category) => [category.name.toLowerCase(), {
    name: category.name.toLowerCase(),
    weight: category.weight,
    reportedEarned: category.earned,
    reportedPossible: category.possible,
    earned: 0,
    possible: 0,
    earnedChange: 0,
    possibleChange: 0,
  }]));
  if (totals.size !== categories.length) return null;

  for (const assignment of assignments) {
    const total = totals.get(weighted ? assignment.category.toLowerCase() : "");
    const edit = edits[assignment.id];
    const scored = assignment.earned !== null && assignment.possible !== null;
    if (!total) {
      if (scored || edit) return null;
      continue;
    }
    const earned = scored ? assignment.earned : 0;
    const possible = scored ? assignment.possible : 0;
    total.earned += earned;
    total.possible += possible;
    if (edit) {
      total.earnedChange += edit.earned - earned;
      total.possibleChange += edit.possible - possible;
    }
  }

  const current = [...totals.values()].map((total) => ({
    ...total,
    earned: total.reportedEarned ?? total.earned,
    possible: total.reportedPossible ?? total.possible,
  }));
  const baseline = weightedPercent(current);
  if (course.percent != null && (baseline === null || Math.abs(baseline - course.percent) > 0.5)) {
    return null;
  }

  for (const assignment of added) {
    const total = current.find((category) => category.name === (weighted ? assignment.category.toLowerCase() : ""));
    if (!total) return null;
    total.earnedChange += assignment.earned;
    total.possibleChange += assignment.possible;
  }

  const projected = current.map(({ weight, earned, possible, earnedChange, possibleChange }) => ({
    weight,
    earned: earned + earnedChange,
    possible: possible + possibleChange,
  }));
  if (projected.some(({ earned, possible }) => earned < -1e-8 || possible < -1e-8)) return null;
  return weightedPercent(projected);
}

export function parseScore({ earned, possible }) {
  const point = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (!point.test(earned) || !point.test(possible)) return null;
  const score = { earned: Number(earned), possible: Number(possible) };
  return Number.isFinite(score.earned) && Number.isFinite(score.possible) ? score : null;
}

const scored = ({ earned, possible, excluded }) => !excluded &&
  Number.isFinite(earned) && Number.isFinite(possible);
const scoreDate = (assignment) => assignment.gradedDate || assignment.date || "";
export const courseKey = (term, course) => JSON.stringify([term, course.period, course.name]);

export function gradeTrend(course) {
  const assignments = (course.assignments || []).filter(scored)
    .sort((first, second) => scoreDate(first).localeCompare(scoreDate(second)));
  const weights = courseWeights(course);
  const totals = new Map(weights.map(({ name, weight }) => [
    name.toLowerCase(), { weight, earned: 0, possible: 0 },
  ]));
  const weighted = Boolean(course.categories?.length);
  const trend = new Map();
  for (const assignment of assignments) {
    const date = scoreDate(assignment);
    const total = totals.get(weighted ? assignment.category.toLowerCase() : "");
    if (!date || !total) return [];
    total.earned += assignment.earned;
    total.possible += assignment.possible;
    const percent = weightedPercent([...totals.values()]);
    if (percent !== null) trend.set(date, percent);
  }
  return [...trend].map(([date, percent]) => ({ date, percent }));
}

export function recentGrades(gradebook, previous, seen) {
  const assignments = (book) => book.courses.flatMap((course) => {
    const courseId = courseKey(book.term, course);
    return (course.assignments || [])
      .filter((assignment) => scored(assignment) && assignment.possible > 0)
      .map((assignment) => ({
        ...assignment,
        key: JSON.stringify([courseId, assignment.id]),
        courseId,
        course: course.name,
        date: scoreDate(assignment),
      }));
  });
  const current = assignments(gradebook);
  const sameTerm = previous?.term === gradebook.term;
  const prior = new Set(sameTerm ? assignments(previous).map(({ key }) => key) : []);
  const recent = new Map(sameTerm ? seen : []);
  const now = Date.now();
  let count = 0;
  for (const assignment of current) {
    if (sameTerm && !prior.has(assignment.key)) {
      if (!recent.has(assignment.key)) count++;
      recent.set(assignment.key, now);
    }
  }
  const items = current.sort((a, b) =>
    (recent.get(b.key) || 0) - (recent.get(a.key) || 0) || b.date.localeCompare(a.date)
  ).slice(0, 5).map((item) => ({ ...item, isNew: recent.has(item.key) }));
  return {
    count,
    items,
    recent: new Map(items.filter(({ isNew }) => isNew).map(({ key }) => [key, recent.get(key)])),
  };
}

const EXTENSION_ID = "hhaboigakbfcpoemakdmblbfemgjjemf";
const MARK = /^(?:A-?|B[+-]?|C[+-]?|D[+-]?|F|P|PASS|NP|I|INC|W|WP|WF|NG)$/;

export function readGradebook() {
  const runtime = window.chrome?.runtime;
  if (!runtime?.sendMessage) return Promise.resolve({ status: "missing-extension" });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ status: "unavailable" }), 8000);
    try {
      runtime.sendMessage(EXTENSION_ID, { type: "workflow:read-grades" }, (response) => {
        clearTimeout(timeout);
        if (runtime.lastError || !response) {
          resolve({ status: "missing-extension" });
          return;
        }
        resolve(validateGradebook(response));
      });
    } catch {
      clearTimeout(timeout);
      resolve({ status: "missing-extension" });
    }
  });
}

export function validateGradebook(response) {
  if (response.status !== "ok") return { status: response.status };
  if (!Array.isArray(response.courses) || !response.courses.length || response.courses.length > 50) {
    return { status: "unavailable" };
  }
  const courses = response.courses.flatMap((course) => {
    if (typeof course?.name !== "string" || !course.name.trim() || course.name.length > 180) return [];
    return [{
      name: course.name.trim(),
      period: typeof course.period === "string" ? course.period.slice(0, 16) : "",
      percent: Number.isFinite(course.percent) && course.percent >= 0 ? course.percent : null,
      mark: typeof course.mark === "string" && MARK.test(course.mark) ? course.mark : "",
    }];
  });
  if (!courses.length) return { status: "unavailable" };
  const term = typeof response.term === "string" ? response.term.slice(0, 48) : "";
  return { status: "ok", courses, term };
}
