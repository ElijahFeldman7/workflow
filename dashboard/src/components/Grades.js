import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  FCPS_HANDBOOK, FCPS_SCALE, STUDENTVUE, fcpsLetter, pointsForGrade,
  projectGrade, readGradebook,
} from "../lib/grades";
import { useLegacyGrades } from "../lib/useLegacyGrades";

const card = "rounded-xl border border-border bg-card";
const button = "inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 disabled:opacity-50";
const action = "inline-flex items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const input = "min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-foreground tabular-nums";
const cacheDuration = 15 * 60 * 1000;
const categoryWeights = (homework) => [
  { name: "summative", weight: 70 },
  { name: "formative", weight: 30 - homework },
  ...(homework ? [{ name: "homework", weight: homework }] : []),
];

const messages = {
  "missing-extension": "install the browser companion, then reload workflow and try again",
  "open-gradebook": "sign in to studentvue and open grade book, then try again",
  "multiple-gradebooks": "leave only the grade book tab you want to import open, then try again",
  "waiting": "wait for grade book to finish loading, then try again",
  "reload-gradebook": "reload grade book so the browser companion can read it, then try again",
  "no-courses": "open the all classes grade book overview, then try again",
  "unavailable": "couldn’t read grade book. reload it and try again",
  "legacy-sign-in-failed": "fcps rejected the sign-in. check your student id and password or sign in with fcps sso",
  "legacy-retired": "fcps no longer accepts this legacy sign-in. use fcps sso to open studentvue",
  "legacy-unavailable": "couldn’t reach the fcps legacy grade book. try again or open studentvue",
  "legacy-empty": "fcps returned no courses for the current grading period",
};

const projectedLabel = (value) => `${Number(value.toFixed(4))}%`;
const pointValue = (value) => value === "" || value === undefined ? 0 : Number(value);

function PointsField({ label, value, onChange, max }) {
  return (
    <input
      aria-label={label}
      className={input}
      type="number"
      min="0"
      max={max}
      step="any"
      placeholder="0"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function WhatIf() {
  const id = useId();
  const [homeworkWeight, setHomeworkWeight] = useState(0);
  const [totals, setTotals] = useState({});
  const [category, setCategory] = useState("summative");
  const [earned, setEarned] = useState("");
  const [possible, setPossible] = useState("");
  const [target, setTarget] = useState("A");

  const categories = categoryWeights(homeworkWeight).map((item) => ({
    ...item,
    earned: pointValue(totals[item.name]?.earned),
    possible: pointValue(totals[item.name]?.possible),
  }));
  const selected = categories.findIndex((item) => item.name === category);
  const assignmentPossible = pointValue(possible);
  const assignmentEarned = pointValue(earned);
  const validPoints = (score, max) => Number.isFinite(max) && max >= 0 &&
    Number.isFinite(score) && score >= 0 && score <= max;
  const totalsValid = categories.every((item) => validPoints(item.earned, item.possible));
  const assignmentValid = validPoints(assignmentEarned, assignmentPossible);
  const baseline = totalsValid ? projectGrade(categories) : null;
  const projection = totalsValid && assignmentValid && assignmentPossible > 0 && earned !== ""
    ? projectGrade(categories, selected, assignmentEarned, assignmentPossible) : null;
  const needed = totalsValid ? pointsForGrade(categories, selected, assignmentPossible, target) : null;

  const updateTotal = (name, field, value) => {
    setTotals((previous) => ({ ...previous, [name]: { ...previous[name], [field]: value } }));
  };
  const changeHomeworkWeight = (event) => {
    const weight = Number(event.target.value);
    if (weight === 0 && category === "homework") setCategory("formative");
    setHomeworkWeight(weight);
  };

  return (
    <section className={`${card} self-start p-5 sm:p-6`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold">what-if calculator</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        enter the category totals from one class to see how a future assignment could change its grade.
      </p>
      <label className="mt-4 flex items-center justify-between gap-3 text-sm">
        homework weight
        <select className={`${input} max-w-24`} value={homeworkWeight} onChange={changeHomeworkWeight}>
          {Array.from({ length: 11 }, (_, weight) => <option key={weight} value={weight}>{weight}%</option>)}
        </select>
      </label>
      <table className="mt-4 w-full table-fixed text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-1/2 pb-2 font-medium">category</th>
            <th scope="col" className="px-1 pb-2 font-medium">earned</th>
            <th scope="col" className="pl-1 pb-2 font-medium">possible</th>
          </tr>
        </thead>
        <tbody>
          {categories.map(({ name, weight }) => (
            <tr key={name}>
              <th scope="row" className="py-1 pr-1 font-medium">
                {name} <span className="text-xs font-normal text-muted-foreground">{weight}%</span>
              </th>
              {["earned", "possible"].map((field) => (
                <td key={field} className="py-1 pl-1">
                  <PointsField label={`${name} points ${field}`} value={totals[name]?.[field]}
                    onChange={(value) => updateTotal(name, field, value)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <fieldset className="mt-5 border-t border-border pt-4">
        <legend className="sr-only">next assignment</legend>
        <label className="flex items-center justify-between gap-3 text-sm">
          next assignment
          <select className={`${input} max-w-40`} value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map(({ name }) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            predicted points
            <PointsField label="predicted points" value={earned} max={possible || undefined} onChange={setEarned} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            points possible
            <PointsField label="assignment points possible" value={possible} onChange={setPossible} />
          </label>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
          target grade
          <select className={`${input} max-w-24`} value={target} onChange={(event) => setTarget(event.target.value)}>
            {FCPS_SCALE.filter(([, cutoff]) => cutoff).map(([letter]) => <option key={letter}>{letter}</option>)}
          </select>
        </label>
      </fieldset>
      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm" aria-live="polite">
        {(!totalsValid || !assignmentValid) && (
          <p className="text-destructive">points earned must be between zero and points possible</p>
        )}
        {baseline !== null && <p>current estimate <strong className="ml-1">{projectedLabel(baseline)} · {fcpsLetter(baseline)}</strong></p>}
        {projection !== null && <p>after assignment <strong className="ml-1">{projectedLabel(projection)} · {fcpsLetter(projection)}</strong></p>}
        {needed !== null && (
          <p className="mt-1 text-muted-foreground">
            {needed === Infinity ? `this assignment alone can’t reach ${target}`
              : `${needed} / ${assignmentPossible} points needed for ${target} or higher`}
          </p>
        )}
        {totalsValid && assignmentValid && baseline === null && needed === null &&
          <p className="text-muted-foreground">add points to see an estimate</p>}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        estimates use points within each category and redistribute weights across categories with scores.
      </p>
    </section>
  );
}

function GradeCourses({ snapshot }) {
  if (!snapshot) {
    return (
      <div className="px-5 py-12 text-center sm:px-6">
        <p className="font-medium">no grades loaded</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          connect studentvue to see your classes and grades.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {snapshot.courses.map(({ name, period, percent, mark }, index) => {
        const calculated = fcpsLetter(percent);
        return (
          <li key={index} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="break-words font-medium">{name}</p>
              {period && <p className="text-xs text-muted-foreground">period {period}</p>}
            </div>
            <div className="shrink-0 text-right">
              <div className="flex items-center justify-end gap-2 tabular-nums">
                {percent !== null && <span className="text-sm font-medium">{percent}%</span>}
                {(mark || calculated) && <strong className="rounded-md bg-primary/10 px-2 py-1 text-sm text-primary">{mark || calculated}</strong>}
                {!mark && !calculated && <span className="text-sm text-muted-foreground">ungraded</span>}
              </div>
              {calculated && calculated !== mark && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {mark ? `fcps rounded estimate ${calculated}` : "fcps rounded estimate"}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function LegacySignIn({ busy, connected, disabled, onConnect, onDisconnect, onRefresh }) {
  const studentId = useRef(null);
  const password = useRef(null);

  const submit = (event) => {
    event.preventDefault();
    const username = studentId.current.value.trim();
    const secret = password.current.value;
    event.currentTarget.reset();
    if (username && secret) onConnect(username, secret);
  };

  return (
    <section className={`${card} px-5 py-4 sm:px-6`} aria-labelledby="studentvue-connection-heading">
      <h2 id="studentvue-connection-heading" className="text-lg font-semibold">studentvue connection</h2>
      {connected ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            connected · grades refresh every five minutes while you’re on this tab
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={onRefresh} disabled={busy}>
              {busy ? "refreshing…" : "refresh now"}
            </button>
            <button type="button" className={button} onClick={onDisconnect}>disconnect</button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            legacy sign-in uses your fcps student id and password. your browser sends them
            directly to fcps and keeps them in memory for refreshes until you disconnect,
            sign out of workflow, or close or reload the page.
          </p>
          <form className="mt-3 space-y-3" autoComplete="off" onSubmit={submit}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">
                student id
                <input ref={studentId} className={input} maxLength={128} required disabled={busy || disabled} />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                fcps password
                <input ref={password} className={input} type="password" maxLength={256} required disabled={busy || disabled} />
              </label>
            </div>
            {busy ? (
              <button type="button" className={button} onClick={onDisconnect}>cancel sign-in</button>
            ) : (
              <button type="submit" className={action} disabled={disabled}>connect with legacy sign-in</button>
            )}
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            fcps plans to retire legacy sign-in in december 2026.{" "}
            <a className="font-medium text-primary hover:underline" href="https://www.fcps.edu/services/technology/tools/sis-studentvue/sis-studentvue-mobile-app" target="_blank" rel="noreferrer">fcps sign-in guidance</a>
          </p>
        </>
      )}
    </section>
  );
}

export default function Grades({ active = true }) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const showResult = useCallback((result) => {
    if (result.status === "ok") {
      setSnapshot({ ...result, readAt: new Date() });
      setStatus("");
    } else {
      setStatus(messages[result.status] || messages.unavailable);
    }
  }, []);
  const legacy = useLegacyGrades({ active, onResult: showResult });

  const disconnect = () => {
    legacy.disconnect();
    setSnapshot(null);
    setStatus("");
  };

  const connect = (username, password) => {
    setSnapshot(null);
    setStatus("");
    legacy.connect(username, password);
  };

  useEffect(() => {
    if (!snapshot) return;
    const timeout = setTimeout(() => setSnapshot(null), cacheDuration);
    return () => clearTimeout(timeout);
  }, [snapshot]);

  const refresh = async () => {
    setBusy(true);
    setStatus("");
    showResult(await readGradebook());
    setBusy(false);
  };

  return (
    <div className="space-y-5 text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">grades</h1>
          <p className="mt-1 text-sm text-muted-foreground">check your classes and see how your next assignment could affect your grade.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className={button} href={STUDENTVUE} target="_blank" rel="noreferrer">open studentvue</a>
        </div>
      </header>

      {status && <p role="status" className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">{status}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-4">
          <section className={card} aria-labelledby="gradebook-courses-heading">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h2 id="gradebook-courses-heading" className="text-lg font-semibold">courses</h2>
                {snapshot && (
                  <p className="text-xs text-muted-foreground">
                    {snapshot.term && `${snapshot.term.toLowerCase()} · `}
                    read at {snapshot.readAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}
                  </p>
                )}
              </div>
              {snapshot && !legacy.connected && (
                <button type="button" className={button} disabled={busy || legacy.busy} onClick={disconnect}>clear grades</button>
              )}
            </div>
            <GradeCourses snapshot={snapshot} />
          </section>

          {active && <LegacySignIn
            busy={legacy.busy}
            connected={legacy.connected}
            disabled={busy}
            onConnect={connect}
            onDisconnect={disconnect}
            onRefresh={legacy.refresh}
          />}

          {!legacy.connected && !legacy.busy && <details className={`${card} px-5 py-4 sm:px-6`}>
            <summary className="cursor-pointer text-sm font-medium">browser companion setup</summary>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                download and unzip the companion. in chrome or edge, open the extensions page,
                enable developer mode, and choose “load unpacked” to select the unzipped folder.
              </p>
              <p>sign in on studentvue and leave its grade book overview open. when fcps ends your session, sign in there again.</p>
              <button className={button} type="button" onClick={refresh} disabled={busy}>
                {busy ? "reading grade book…" : "read grade book"}
              </button>
              {process.env.NODE_ENV === "production" ? (
                <a className="inline-block font-medium text-primary hover:underline" href="/workflow-gradebook-companion.zip" download>download companion</a>
              ) : (
                <p>for local development, load the companion folder using the dashboard readme.</p>
              )}
            </div>
          </details>}
          <p className="text-xs leading-relaxed text-muted-foreground">
            grades stay in this tab’s memory for up to 15 minutes after each fetch.
            numerical estimates round to the nearest whole number, so 92.5% earns an A.{" "}
            <a className="font-medium text-primary hover:underline" href={FCPS_HANDBOOK} target="_blank" rel="noreferrer">fcps grading handbook</a>
          </p>
        </div>
        <WhatIf />
      </div>
    </div>
  );
}
