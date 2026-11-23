import { FCPS_SCALE, fcpsLetter, pointsForGrade, projectGrade } from "./grades";

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

const categories = [
  { weight: 70, earned: 90, possible: 100 },
  { weight: 30, earned: 100, possible: 100 },
];

test("keeps point totals intact and excludes a category until it has a score", () => {
  const withHomework = [
    categories[0],
    { ...categories[1], weight: 20 },
    { weight: 10, earned: 0, possible: 0 },
  ];
  expect(projectGrade(withHomework)).toBeCloseTo(92.222222);
  expect(projectGrade(withHomework, 2, 0, 10)).toBe(83);
  expect(withHomework[2].possible).toBe(0);
});

test("finds the minimum score at hundredth-point precision and respects unachievable targets", () => {
  const required = pointsForGrade(categories, 0, 50, "A");
  expect(required).toBe(43.93);
  expect(fcpsLetter(projectGrade(categories, 0, required, 50))).toBe("A");
  expect(fcpsLetter(projectGrade(categories, 0, required - 0.01, 50))).toBe("A-");
  expect(pointsForGrade(categories, 0, 1, "B")).toBe(0);
  expect(pointsForGrade([{ weight: 70, earned: 50, possible: 100 }], 0, 5, "A")).toBe(Infinity);
});
