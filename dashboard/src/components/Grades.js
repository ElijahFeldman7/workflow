import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import { STUDENTVUE, courseKey, fcpsLetter, gradeTrend, parseScore, projectCourseGrade, readGradebook, recentGrades } from "../lib/grades";
import GradeTrend from "./GradeTrend";
import { rememberGradeConnection, shouldReconnectGrades, useLegacyGrades } from "../lib/useLegacyGrades";
import { schoolYearFor, syncStudentVueClasses } from "../lib/studentvueClasses";

const quiet = "rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50";
const input = "grades-field min-w-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-base text-foreground";
const cacheDuration = 15 * 60 * 1000;
const gradeColor = (grade) => grade === "A" ? "text-emerald-700 dark:text-emerald-400"
  : /^[A-F][+-]?$/.test(grade || "") ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
const messages = {
  "missing-extension": "Install the browser companion first",
  "open-gradebook": "Open Grade Book in StudentVUE",
  "multiple-gradebooks": "Keep one StudentVUE gradebook open",
  waiting: "Wait for StudentVUE to finish loading",
  "reload-gradebook": "Reload Grade Book in StudentVUE",
  "no-courses": "Open the all classes overview in StudentVUE",
  unavailable: "Couldn’t read StudentVUE",
  "legacy-sign-in-failed": "FCPS rejected the student ID or password",
  "legacy-retired": "FCPS legacy sign-in is unavailable",
  "legacy-unavailable": "Couldn’t read the FCPS legacy gradebook",
  "legacy-empty": "No courses for this grading period",
};
const emptyScenario = { scores: {}, added: [] };

function GradeValue({ percent, mark, projected = false }) {
  const letter = mark && !/^[A-F][+-]?$/.test(mark) ? mark : fcpsLetter(percent) || mark;
  return (
    <span className="inline-flex shrink-0 items-baseline gap-2 text-sm tabular-nums">
      {projected && <span className="text-xs text-muted-foreground">Projected</span>}
      {Number.isFinite(percent) && <span className="text-muted-foreground">{Number(percent.toFixed(2))}%</span>}
      <span
        className={`min-w-[1.75rem] text-right text-lg font-semibold ${gradeColor(letter)}`}
        title={mark && letter !== mark ? `StudentVUE mark ${mark}` : undefined}
      >
        {letter || "—"}
      </span>
      {mark && letter !== mark && <span className="sr-only">StudentVUE mark {mark}</span>}
    </span>
  );
}

function scoreLabel({ earned, possible, score }) {
  if (earned !== null && possible !== null) return `${earned}/${possible}`;
  if (score) return score;
  return possible === null ? "—" : `—/${possible}`;
}

function ScoreInputs({ name, values, onChange, readOnly = false, actual, postedScore }) {
  const paste = (event) => {
    const [earned, possible, extra] = event.clipboardData.getData("text").split("/").map((part) => part.trim());
    if (readOnly || extra !== undefined || !parseScore({ earned, possible })) return;
    event.preventDefault();
    onChange({ earned, possible });
  };

  return (
    <div className="flex items-center gap-0.5 tabular-nums" title={actual}>
      {["earned", "possible"].map((field) => (
        <span key={field} className="contents">
          {field === "possible" && <span aria-hidden="true" className="text-sm text-muted-foreground">/</span>}
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`${field === "earned" ? "Earned" : "Possible"} points for ${name}`}
            placeholder={(field === "earned" && postedScore) || "—"}
            maxLength={10}
            value={values[field] ?? ""}
            readOnly={readOnly}
            onChange={(event) => {
              const value = event.target.value.replace(",", ".");
              if (/^\d*\.?\d*$/.test(value)) onChange({ ...values, [field]: value });
            }}
            onPaste={paste}
            className="h-9 w-12 rounded bg-transparent px-0.5 text-center text-base text-foreground outline-none placeholder:text-muted-foreground focus:bg-muted/60 focus:ring-1 focus:ring-border sm:w-14"
          />
        </span>
      ))}
    </div>
  );
}

function NewAssignment({ categories, onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]?.name || "");
  const [values, setValues] = useState({ earned: "", possible: "" });
  const score = parseScore(values);

  return (
    <form className="grid gap-2 border-b border-border py-3" onSubmit={(event) => {
      event.preventDefault();
      if (score) onAdd({ name: name.trim() || "New assignment", category, ...score });
    }}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input
          autoFocus
          aria-label="Assignment name"
          placeholder="Assignment name"
          className={`${input} text-base`}
          maxLength={150}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <ScoreInputs name="new assignment" values={values} onChange={setValues} />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {categories.length > 1 && (
          <select className={`${input} mr-auto max-w-full`} aria-label="Assignment category" value={category}
            onChange={(event) => setCategory(event.target.value)}>
            {categories.map(({ name: label }) => <option key={label}>{label}</option>)}
          </select>
        )}
        <button type="submit" className={`${quiet} text-primary`} disabled={!score}>Add</button>
        <button type="button" className={quiet} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function CourseDetail({ course, scenario, showGraph, onEdit, onAdd, onRemove, onReset, onBack }) {
  const [adding, setAdding] = useState(false);
  const [actualOnly, setActualOnly] = useState(false);
  const assignments = course.assignments || [];
  const categoryOptions = course.categories || [];
  const edits = {};
  for (const assignment of assignments) {
    const score = scenario.scores[assignment.id] && parseScore(scenario.scores[assignment.id]);
    if (score && (score.earned !== assignment.earned || score.possible !== assignment.possible)) {
      edits[assignment.id] = score;
    }
  }
  const added = scenario.added.flatMap((assignment) => {
    const score = parseScore(scenario.scores[assignment.id] || assignment);
    return score ? [{ ...assignment, ...score }] : [];
  });
  const hasEdits = Object.keys(edits).length > 0 || added.length > 0;
  const hasDrafts = Object.keys(scenario.scores).length > 0 || scenario.added.length > 0;
  const showingActual = actualOnly && hasDrafts;
  const projection = hasEdits ? projectCourseGrade(course, edits, added) : null;
  const trend = useMemo(() => showGraph ? gradeTrend(course) : [], [course, showGraph]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className={`${quiet} min-h-10`} onClick={onBack} aria-label="Back to Grades">
            <ChevronLeftIcon />
          </button>
          <h1 className="min-w-0 break-words text-xl font-semibold text-foreground">{course.name}</h1>
        </div>
        <GradeValue
          percent={showingActual ? course.percent : projection ?? course.percent}
          mark={showingActual || projection === null ? course.mark : undefined}
          projected={!showingActual && projection !== null}
        />
      </header>
      {showGraph && <GradeTrend points={trend} />}
      {course.assignments ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-border">
            <button className={`${quiet} mr-auto min-h-9 text-primary`} type="button" onClick={() => {
              setActualOnly(false);
              setAdding(!adding);
            }}
              aria-expanded={adding}>Add assignment</button>
            {!showingActual && hasEdits && projection === null && (
              <span className="text-xs text-muted-foreground" role="status">No projection</span>
            )}
            {hasDrafts && <>
              <button type="button" className={quiet} aria-pressed={showingActual} onClick={() => {
                setAdding(false);
                setActualOnly(!showingActual);
              }}>{showingActual ? "Show edits" : "Show actual"}</button>
              <button type="button" className={quiet} onClick={() => {
                setActualOnly(false);
                onReset();
              }}>Reset edits</button>
            </>}
          </div>
          {adding && <NewAssignment categories={categoryOptions} onAdd={(assignment) => {
            onAdd(assignment);
            setAdding(false);
          }} onCancel={() => setAdding(false)} />}
          <ul className="divide-y divide-border">
            {(showingActual ? assignments : [...scenario.added, ...assignments]).map((assignment) => {
              const edit = scenario.scores[assignment.id];
              const actual = edits[assignment.id] ? `Actual ${scoreLabel(assignment)}` : undefined;
              return (
                <li key={assignment.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                    <p className="break-words text-sm font-medium" title={assignment.category || undefined}>{assignment.name}</p>
                    {!showingActual && actual && <span className="text-xs text-muted-foreground">{actual}</span>}
                    {assignment.local && (
                      <button type="button" className="min-h-7 text-xs text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${assignment.name}`} onClick={() => onRemove(assignment.id)}>Remove</button>
                    )}
                  </div>
                  <ScoreInputs name={assignment.name} values={showingActual ? assignment : edit || assignment}
                    readOnly={showingActual} actual={actual} postedScore={assignment.earned === null ? assignment.score : ""}
                    onChange={(value) => onEdit(assignment.id, value)} />
                  {assignment.comment && (
                    <details className="col-span-2 pb-1 text-xs text-muted-foreground">
                      <summary className="w-fit cursor-pointer">Teacher comment</summary>
                      <p className="mt-1 whitespace-pre-line break-words">{assignment.comment}</p>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <a href={STUDENTVUE} target="_blank" rel="noreferrer" className="inline-block py-4 text-sm text-muted-foreground hover:underline">
          View assignments in StudentVUE
        </a>
      )}
    </>
  );
}

function RecentGrades({ items, onSelect }) {
  if (!items.length) return null;
  return (
    <section className="mt-4" aria-labelledby="recent-grades">
      <h2 id="recent-grades" className="border-b border-border pb-2 text-sm font-semibold">Recent grades</h2>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const percent = item.earned / item.possible * 100;
          return (
            <li key={item.key}>
              <button type="button" onClick={() => onSelect(item.courseId)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md py-1 text-left hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="break-words text-sm font-medium">{item.name}</span>
                  <span className="ml-2 break-words text-xs text-muted-foreground">{item.course}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-right">
                  {item.isNew && <span className="text-xs text-primary">New grade</span>}
                  {percent < 80 && <span className="text-xs font-medium text-red-700 dark:text-red-400">Lock in</span>}
                  <span className={`text-sm tabular-nums ${gradeColor(fcpsLetter(percent))}`}>{scoreLabel(item)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Connection({ open, onOpen, resume, legacy, snapshot, importing, status, onConnect, onImport, onDisconnect }) {
  const buttonRef = useRef(null);
  const studentId = useRef(null);
  const password = useRef(null);
  const close = () => {
    onOpen(false);
    buttonRef.current?.focus();
  };
  const submit = (event) => {
    event.preventDefault();
    const username = studentId.current.value.trim();
    const secret = password.current.value;
    if (username && secret) onConnect(username, secret);
  };

  const reconnect = useCallback(() => {
    if (!resume || !open || importing || legacy.busy || legacy.connected) return false;
    const username = studentId.current;
    const secret = password.current;
    if (!username?.value || !secret?.value || !username.matches(":autofill") || !secret.matches(":autofill")) {
      return false;
    }
    onConnect(username.value.trim(), secret.value);
    return true;
  }, [resume, open, importing, legacy.busy, legacy.connected, onConnect]);

  useEffect(() => {
    if (status && password.current) password.current.value = "";
  }, [status]);

  useEffect(() => {
    if (!open || !resume || reconnect()) return;
    const poll = setInterval(() => { if (reconnect()) clearInterval(poll); }, 100);
    const timeout = setTimeout(() => clearInterval(poll), 3000);
    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [open, resume, reconnect]);

  return (
    <div className="relative shrink-0" onKeyDown={(event) => {
      if (event.key === "Escape" && open) close();
    }}>
      <button
        type="button"
        ref={buttonRef}
        className={quiet}
        aria-expanded={open}
        aria-controls="studentvue-connection"
        onClick={() => onOpen(!open)}
      >
        {legacy.connected || snapshot ? "StudentVUE" : "Connect StudentVUE"}
      </button>
      {open && (
        <div id="studentvue-connection" className="grades-connection absolute right-0 z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] space-y-3 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          {legacy.connected ? (
            <div className="grid gap-1">
              <button type="button" className={`${quiet} text-left`} disabled={legacy.busy} onClick={legacy.refresh}>
                {legacy.busy ? "Refreshing" : "Refresh"}
              </button>
              <button type="button" className={`${quiet} text-left`} onClick={onDisconnect}>Disconnect</button>
            </div>
          ) : (
            <>
              <form method="post" action={STUDENTVUE} onSubmit={submit} onInput={reconnect} className="grid gap-2">
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Student ID
                  <input ref={studentId} name="username" autoComplete="username" autoFocus className={input} maxLength={128} required disabled={legacy.busy || importing} />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  FCPS password
                  <input ref={password} name="password" autoComplete="current-password" className={input} type="password" maxLength={256} required disabled={legacy.busy || importing} />
                </label>
                {legacy.busy ? (
                  <button type="button" className={quiet} onClick={onDisconnect}>Cancel sign-in</button>
                ) : (
                  <button type="submit" className={`${quiet} text-primary`} disabled={importing}>Sign in</button>
                )}
              </form>
              <details className="border-t border-border pt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">Browser companion</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={STUDENTVUE} target="_blank" rel="noreferrer" className="hover:underline">Open StudentVUE</a>
                  {process.env.NODE_ENV === "production" && (
                    <a href="/workflow-gradebook-companion.zip" download className="hover:underline">Download companion</a>
                  )}
                  <button type="button" onClick={onImport} disabled={importing || legacy.busy} className="font-medium text-primary hover:underline">
                    {importing ? "Reading Grade Book" : "Read Grade Book"}
                  </button>
                </div>
              </details>
              {snapshot && <button type="button" className={quiet} onClick={onDisconnect}>Clear grades</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Grades({ user, active = true, showGraph = false }) {
  const uid = user?.uid;
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [resume, setResume] = useState(() => shouldReconnectGrades(uid));
  const [authOpen, setAuthOpen] = useState(resume);
  const [selected, setSelected] = useState(null);
  const [scenarios, setScenarios] = useState({});
  const [recent, setRecent] = useState([]);
  const [notice, setNotice] = useState("");
  const previous = useRef(null);
  const detected = useRef(new Map());
  const nextAssignmentId = useRef(0);
  const classSync = useRef({ saved: "", pending: "" });
  const [classSyncError, setClassSyncError] = useState(false);

  const clearGrades = useCallback(() => {
    setSnapshot(null);
    setSelected(null);
    setScenarios({});
    previous.current = null;
    detected.current = new Map();
    setRecent([]);
    setNotice("");
    setClassSyncError(false);
  }, []);
  const showResult = useCallback((result) => {
    if (result.status === "ok") {
      const latest = recentGrades(result, previous.current, detected.current);
      previous.current = result;
      detected.current = latest.recent;
      setRecent(latest.items);
      if (latest.count) setNotice(`${latest.count} new assignment ${latest.count === 1 ? "grade" : "grades"}`);
      setSnapshot(result);
      setStatus("");
      setAuthOpen(false);
    } else {
      setStatus(messages[result.status] || messages.unavailable);
    }
  }, []);
  const handleLegacyResult = useCallback((result) => {
    if (result.status === "ok") rememberGradeConnection(uid, true);
    if (result.status === "legacy-sign-in-failed" || result.status === "legacy-retired") {
      rememberGradeConnection(uid, false);
    }
    showResult(result);
  }, [uid, showResult]);
  const legacy = useLegacyGrades({ active, onResult: handleLegacyResult });

  useEffect(() => {
    if (!uid || !snapshot) return;
    const year = schoolYearFor();
    const termYear = snapshot.termStart ? schoolYearFor(new Date(`${snapshot.termStart}T12:00:00`)) : year;
    if (termYear !== year) return;

    const names = [...new Set(snapshot.courses.map(({ name }) => name))].sort();
    const key = JSON.stringify([uid, year, names]);
    const sync = classSync.current;
    if (key === sync.saved || key === sync.pending) return;
    sync.pending = key;
    syncStudentVueClasses(uid, names, year).then(() => {
      sync.saved = key;
      setClassSyncError(false);
    }, () => setClassSyncError(true)).finally(() => {
      if (sync.pending === key) sync.pending = "";
    });
  }, [snapshot, uid]);

  useEffect(() => {
    if (!snapshot) return;
    const timeout = setTimeout(clearGrades, cacheDuration);
    return () => clearTimeout(timeout);
  }, [snapshot, clearGrades]);

  useEffect(() => {
    if (!active) setAuthOpen(false);
  }, [active]);

  const disconnect = () => {
    legacy.disconnect();
    rememberGradeConnection(uid, false);
    setResume(false);
    clearGrades();
    setStatus("");
    setAuthOpen(false);
  };
  const connect = (username, password) => {
    setResume(false);
    clearGrades();
    setStatus("");
    legacy.connect(username, password);
  };
  const importGrades = async () => {
    setImporting(true);
    setStatus("");
    showResult(await readGradebook());
    setImporting(false);
  };

  const course = snapshot?.courses.find((item) => courseKey(snapshot.term, item) === selected);
  const scenario = scenarios[selected] || emptyScenario;
  const updateScenario = (update) => {
    setScenarios((state) => ({ ...state, [selected]: update(state[selected] || emptyScenario) }));
  };
  const editScore = (id, value) => updateScenario((state) => ({
    ...state,
    scores: { ...state.scores, [id]: value },
  }));
  const addAssignment = (assignment) => {
    const id = `local:${nextAssignmentId.current++}`;
    updateScenario((state) => ({ ...state, added: [...state.added, { ...assignment, id, local: true }] }));
  };
  const removeAssignment = (id) => updateScenario((state) => {
    const scores = { ...state.scores };
    delete scores[id];
    return { scores, added: state.added.filter((assignment) => assignment.id !== id) };
  });
  const selectCourse = (key) => {
    setAuthOpen(false);
    setSelected(key);
  };

  return (
    <section className="mx-auto max-w-3xl text-foreground">
      {course ? (
        <CourseDetail
          key={selected}
          course={course}
          scenario={scenario}
          showGraph={showGraph}
          onEdit={editScore}
          onAdd={addAssignment}
          onRemove={removeAssignment}
          onReset={() => updateScenario(() => emptyScenario)}
          onBack={() => setSelected(null)}
        />
      ) : (
        <>
          <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <h1 className="text-xl font-semibold">Grades</h1>
            {active && (
              <Connection
                open={authOpen}
                onOpen={setAuthOpen}
                resume={resume}
                legacy={legacy}
                snapshot={snapshot}
                importing={importing}
                status={status}
                onConnect={connect}
                onImport={importGrades}
                onDisconnect={disconnect}
              />
            )}
          </header>
          {snapshot && (
            <ul className="divide-y divide-border">
              {snapshot.courses.map((item) => {
                const key = courseKey(snapshot.term, item);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="flex min-h-10 w-full items-center gap-3 rounded-md py-1 text-left hover:bg-muted/40"
                      onClick={() => selectCourse(key)}
                    >
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">{item.name}</span>
                      <GradeValue percent={item.percent} mark={item.mark} />
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <RecentGrades items={recent} onSelect={selectCourse} />
          {snapshot && classSyncError && <p role="status" className="py-2 text-sm text-muted-foreground">Couldn’t sync classes to Work</p>}
        </>
      )}
      <p className="sr-only" role="status">{notice}</p>
      {status && <p role="status" className="py-3 text-sm text-muted-foreground">{status}</p>}
    </section>
  );
}
