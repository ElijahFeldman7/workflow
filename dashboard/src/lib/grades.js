// FCPS secondary grading handbook. Numerical averages round before the lookup.
export const FCPS_HANDBOOK = "https://www.fcps.edu/academics/grading-and-reporting/secondary-school";
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

export function projectGrade(categories, selected, earned, possible) {
  const withScore = categories.map((category, index) => index === selected
    ? { ...category, earned: category.earned + earned, possible: category.possible + possible }
    : category
  );
  const active = withScore.filter((category) => category.weight > 0 && category.possible > 0);
  const totalWeight = active.reduce((sum, category) => sum + category.weight, 0);
  if (!totalWeight) return null;
  const ratio = active.reduce((sum, { weight, earned, possible }) =>
    sum + weight * earned / possible, 0) / totalWeight;
  // Remove floating-point noise near an exact half-point boundary.
  return Number((ratio * 100).toFixed(12));
}

export function pointsForGrade(categories, selected, possible, target) {
  const cutoff = FCPS_SCALE.find(([letter]) => letter === target)?.[1];
  if (!cutoff || !Number.isFinite(possible) || possible <= 0 || !categories[selected]?.weight) return null;
  const low = projectGrade(categories, selected, 0, possible);
  if (low >= cutoff - 0.5) return 0;
  const high = projectGrade(categories, selected, possible, possible);
  if (high < cutoff - 0.5) return Infinity;
  const exact = possible * ((cutoff - 0.5) - low) / (high - low);
  const roundedUp = Math.ceil(Number((exact * 100).toFixed(9))) / 100;
  return Math.min(possible, roundedUp);
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
