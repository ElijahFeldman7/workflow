import { captureText } from "../capture";

const now = new Date(2026, 8, 5);

const spaces = [
  { id: "s1", name: "AP Biology", kind: "class", teacher: "Nguyen", room: "214" },
  { id: "s2", name: "Computer Team", kind: "club" },
  { id: "s3", name: "Multivariable Calculus", kind: "class" },
  { id: "s4", name: "AP Physics", kind: "class" },
  { id: "s5", name: "Scioly", kind: "club" },
];

const run = (text) => captureText(text, { spaces, now });

const CASES = [
  {
    text: "cell lab writeup for bio due friday",
    title: "cell lab writeup",
    spaceId: "s1",
    type: "lab",
    mode: "due",
    date: "2026-09-11",
  },
  {
    text: "study for the multivar test next tuesday",
    title: "study",
    spaceId: "s3",
    type: "test",
    date: "2026-09-08",
  },
  {
    text: "physics pset 3 due sept 14",
    title: "physics pset 3",
    spaceId: "s4",
    type: "hw",
    date: "2026-09-14",
  },
  {
    text: "computer team meeting thursday 3-4:30pm in room 214",
    spaceId: "s2",
    mode: "event",
    date: "2026-09-10",
    time: "15:00",
    endTime: "16:30",
    location: "room 214",
  },
  {
    text: "read chapter 7 bio by tomorrow",
    title: "read chapter 7",
    spaceId: "s1",
    type: "reading",
    date: "2026-09-06",
  },
  {
    text: "activity fair 9/12 3-5pm",
    title: "activity fair",
    mode: "event",
    date: "2026-09-12",
    time: "15:00",
    endTime: "17:00",
  },
  {
    text: "finish the bio lab report urgent",
    title: "finish the bio lab report",
    spaceId: "s1",
    type: "lab",
    priority: "high",
    date: "",
  },
  {
    text: "quiz on kinematics friday !!!",
    title: "quiz on kinematics",
    type: "quiz",
    priority: "high",
    date: "2026-09-11",
  },
  {
    text: "orchestra rehearsal tonight 7pm for 2 hours",
    title: "orchestra rehearsal",
    mode: "event",
    date: "2026-09-05",
    time: "19:00",
    endTime: "21:00",
  },
  {
    text: "turn in scholarship form by the end of the month",
    title: "turn in scholarship form",
    mode: "due",
    date: "2026-09-30",
  },
  {
    text: "unit 1 test kinematics 9/10",
    title: "unit 1 test kinematics",
    type: "test",
    date: "2026-09-10",
  },
  {
    text: "bioloy homwork tmrw",
    title: "bioloy homwork",
    spaceId: "s1",
    date: "2026-09-06",
  },
  {
    text: "Scioly Orientation 9/11 event",
    title: "Scioly Orientation",
    spaceId: "s5",
    mode: "event",
    type: "",
    date: "2026-09-11",
  },
  {
    text: "Cell lab writeup #bio /lab @3pm !!!! fri",
    title: "Cell lab writeup",
    spaceId: "s1",
    type: "lab",
    priority: "insane",
    time: "15:00",
    date: "2026-09-11",
  },
  {
    text: 'essay #"AP Physics" due the 14th',
    title: "essay",
    spaceId: "s4",
    date: "2026-09-14",
  },
  {
    text: "lab report",
    title: "lab report",
    type: "lab",
    date: "",
    spaceId: "",
  },
  {
    text: "bio",
    title: "bio",
    spaceId: "s1",
  },
  {
    text: "read pages 40-52 tonight",
    title: "read pages 40-52",
    type: "reading",
    date: "2026-09-05",
  },
  {
    text: "college app essay due in 2 weeks",
    title: "college app essay",
    spaceId: "",
    type: "application",
    date: "2026-09-19",
  },
  {
    text: "physics test 12/25 !!",
    title: "physics test",
    spaceId: "s4",
    type: "test",
    priority: "medium",
    date: "2026-12-25",
  },
];

describe("golden corpus", () => {
  CASES.forEach((expected) => {
    test(expected.text, () => {
      const result = run(expected.text);
      Object.entries(expected).forEach(([key, value]) => {
        if (key === "text") return;
        expect({ [key]: result[key] }).toEqual({ [key]: value });
      });
    });
  });
});

describe("invariants that must hold for every case", () => {
  CASES.forEach(({ text }) => {
    test(`${text} keeps a title and valid enums`, () => {
      const result = run(text);
      expect(result.title.length).toBeGreaterThan(0);
      expect(["due", "event"]).toContain(result.mode);
      expect(["low", "medium", "high", "insane"]).toContain(result.priority);
      if (result.date) expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (result.time) expect(result.time).toMatch(/^\d{2}:\d{2}$/);
      if (result.endTime) expect(result.endTime).toMatch(/^\d{2}:\d{2}$/);
      if (result.spaceId)
        expect(spaces.some((space) => space.id === result.spaceId)).toBe(true);
    });
  });
});

describe("confidence is reported for what was found", () => {
  test("explicit sigils are more confident than a semantic guess", () => {
    const explicit = run("essay #bio");
    const guessed = run("bioloy essay");
    expect(explicit.confidence.space).toBeGreaterThan(guessed.confidence.space);
  });

  test("fields that were not found carry no confidence", () => {
    const result = run("some plain title");
    expect(result.confidence.date).toBeUndefined();
    expect(result.confidence.time).toBeUndefined();
  });

  test("filled reports exactly which fields were understood", () => {
    const result = run("lab writeup #bio fri");
    expect(result.filled).toMatchObject({
      title: true,
      space: true,
      date: true,
      time: false,
      location: false,
    });
  });
});

test("a time range makes it an event even without an event word", () => {
  expect(run("study session 3-5pm").mode).toBe("event");
});

test("a duration only applies when there is a start time", () => {
  expect(run("essay for 2 hours").endTime).toBe("");
  expect(run("essay 3pm for 2 hours").endTime).toBe("17:00");
});

describe("the title is distilled down to the thing itself", () => {
  const CARRIER_CASES = [
    { text: "i have a bio test on friday", title: "bio test", spaceId: "s1", type: "test" },
    { text: "i need to do my bio homework", title: "bio homework", spaceId: "s1", type: "hw" },
    { text: "there is a physics quiz tomorrow", title: "physics quiz", spaceId: "s4", type: "quiz" },
    { text: "i've got a bio test friday", title: "bio test", spaceId: "s1" },
    { text: "gotta do bio hw tonight", title: "bio hw", spaceId: "s1", type: "hw" },
    { text: "can you remind me about the physics test on monday", title: "physics test", spaceId: "s4" },
    { text: "dont forget the scioly meeting thursday", title: "scioly meeting", spaceId: "s5" },
    { text: "please turn in the scholarship form friday", title: "turn in the scholarship form" },
  ];

  CARRIER_CASES.forEach((expected) => {
    test(expected.text, () => {
      const result = run(expected.text);
      Object.entries(expected).forEach(([key, value]) => {
        if (key === "text") return;
        expect({ [key]: result[key] }).toEqual({ [key]: value });
      });
    });
  });

  test("a verb the user meant is not mistaken for filler", () => {
    expect(run("finish the bio lab report").title).toBe("finish the bio lab report");
    expect(run("read chapter 7 bio by tomorrow").title).toBe("read chapter 7");
  });

  test("filler alone still leaves something to look at", () => {
    expect(run("i have to").title.length).toBeGreaterThan(0);
  });
});

test("an unmatched #name is offered as a new class", () => {
  const result = run("essay #Ceramics fri");
  expect(result.spaceId).toBe("");
  expect(result.newSpaceName).toBe("Ceramics");
});
