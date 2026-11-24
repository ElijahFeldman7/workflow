import { FCPS_SCALE, fcpsLetter, gradeTrend, projectCourseGrade, recentGrades } from "./grades";

test.each(FCPS_SCALE.filter(([, cutoff]) => cutoff))(
  "rounds the FCPS %s boundary only at the half-point",
  (letter, cutoff) => {
    expect(fcpsLetter(cutoff - 0.5)).toBe(letter);
    expect(fcpsLetter(cutoff - 0.5001)).not.toBe(letter);
  }
);

test("keeps an unreported grade empty and uses the current FCPS D band", () => {
  expect(fcpsLetter(null)).toBeNull();
  expect(fcpsLetter(60)).toBe("D");
  expect(fcpsLetter(0)).toBe("F");
});

test("applies edits to the reported weighted totals and excludes excused work", () => {
  const course = {
    percent: 93,
    categories: [
      { name: "Summative", weight: 70, earned: 90, possible: 100 },
      { name: "Formative", weight: 30, earned: 100, possible: 100 },
    ],
    assignments: [
      { id: "test", category: "Summative", earned: 40, possible: 50 },
      { id: "practice", category: "Formative", earned: null, possible: 10 },
      { id: "excused", category: "Formative", earned: 10, possible: 10, excluded: true },
    ],
  };
  const edits = {
    test: { earned: 45, possible: 50 },
    practice: { earned: 0, possible: 10 },
    excused: { earned: 0, possible: 100 },
  };
  expect(projectCourseGrade(course, edits)).toBeCloseTo(93.772727);
  expect(course.categories[0].earned).toBe(90);
});

test("projects point-based courses only when imported scores agree with the posted grade", () => {
  const course = { percent: 85, assignments: [{ id: "quiz", category: "", earned: 85, possible: 100 }] };
  const edits = { quiz: { earned: 92.5, possible: 100 } };
  expect(fcpsLetter(projectCourseGrade(course, edits))).toBe("A");
  expect(projectCourseGrade({ ...course, percent: 89 }, edits)).toBeNull();
  expect(projectCourseGrade(course, {}, [{ earned: 14, possible: 15 }])).toBeCloseTo(86.0869565);
});

test("builds the trend from posted scores in date order without counting ungraded work", () => {
  const course = { assignments: [
    { earned: 14, possible: 15, date: "2026-11-20" },
    { earned: 8, possible: 10, date: "2026-11-18" },
    { earned: null, possible: 10, date: "2026-11-19" },
  ] };
  expect(gradeTrend(course)).toEqual([
    { date: "2026-11-18", percent: 80 },
    { date: "2026-11-20", percent: 88 },
  ]);
});

test("a newly posted score is reported once and sorts above older grades", () => {
  const course = { period: "1", name: "Algebra", assignments: [
    { id: "1", earned: null, possible: 15, date: "2026-11-18" },
    { id: "2", earned: 8, possible: 10, date: "2026-11-20" },
  ] };
  const before = { term: "Q2", courses: [course] };
  const after = { term: "Q2", courses: [{ ...course, assignments: [
    { ...course.assignments[0], earned: 11 },
    course.assignments[1],
  ] }] };
  const first = recentGrades(before, null, new Map());
  expect(first.count).toBe(0);
  const second = recentGrades(after, before, first.recent);
  expect(second.count).toBe(1);
  expect(second.items.map(({ id, isNew }) => [id, isNew])).toEqual([["1", true], ["2", false]]);
  expect(recentGrades(after, after, second.recent).count).toBe(0);
});
