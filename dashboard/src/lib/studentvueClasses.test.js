import { captureText } from "./capture/capture";
import { mergeStudentVueClasses, schoolYearFor } from "./studentvueClasses";

const idFor = () => "new-class";

test("adds one real Work class per course without duplicating existing classes", () => {
  const current = {
    manual: { kind: "class", name: "English & Composition", color: "blue", order: 2 },
    club: { kind: "club", name: "Robotics" },
  };
  const next = mergeStudentVueClasses(
    current, ["English and Composition", "AP Biology", " AP BIOLOGY "], 2026, idFor, 1
  );
  expect(next.manual).toBe(current.manual);
  expect(Object.keys(next)).toEqual(["manual", "club", "new-class"]);
  expect(next["new-class"]).toMatchObject({
    name: "AP Biology",
    kind: "class",
    order: 3,
    studentVue: { course: "ap biology", schoolYear: 2026 },
  });
  expect(mergeStudentVueClasses(next, ["AP Biology"], 2026, idFor, 2)).toBeUndefined();

  const spaces = Object.entries(next).map(([id, space]) => ({ id, ...space }));
  expect(captureText("AP Biology lab Friday", { spaces }).spaceId).toBe("new-class");
});

test("keeps a renamed class linked and archives only older StudentVUE classes at rollover", () => {
  const current = {
    imported: {
      kind: "class", name: "Bio", studentVue: { course: "ap biology", schoolYear: 2025 },
    },
    manual: { kind: "class", name: "Art", archived: false },
  };
  expect(mergeStudentVueClasses(current, ["AP Biology"], 2025, idFor, 2)).toBeUndefined();
  const next = mergeStudentVueClasses(current, ["AP Biology"], 2026, idFor, 3);
  expect(next.imported.archived).toBe(true);
  expect(next.manual).toBe(current.manual);
  expect(next["new-class"].studentVue.schoolYear).toBe(2026);
  expect(mergeStudentVueClasses(next, ["Old class"], 2025, idFor, 4)).toBeUndefined();
});

test("keeps spring and summer in the preceding school year", () => {
  expect(schoolYearFor(new Date(2027, 6, 31))).toBe(2026);
  expect(schoolYearFor(new Date(2027, 7, 1))).toBe(2027);
});
