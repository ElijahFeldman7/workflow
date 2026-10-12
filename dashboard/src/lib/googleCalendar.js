import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import { DEFAULT_PRIORITY, toDateKey } from "../constants/work";

// Read-only, permanently. Only the read scope is asked for, a token that still
// carries an older write grant is turned away, and every request below is a
// GET. Writing was removed after a sync deleted events people had been invited
// to, which Google reports to the organiser as a decline.
export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
const WRITE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];
export const API_BASE = "https://www.googleapis.com/calendar/v3";

const TOKEN_KEY = "googleCalendarToken";
const TOKEN_TTL_MS = 55 * 60 * 1000;

export class GoogleAuthRequired extends Error {
  constructor(message) {
    super(message || "Google Calendar access has expired. Reconnect to continue.");
    this.name = "GoogleAuthRequired";
  }
}

export class GoogleScopeDenied extends Error {
  constructor(message) {
    super(
      message ||
        "Calendar permission was not granted. Connect again and tick the calendar checkbox on Google's consent screen — the app cannot read your calendar without it."
    );
    this.name = "GoogleScopeDenied";
  }
}

export class GoogleStaleGrant extends Error {
  constructor(message) {
    super(
      message ||
        "Google still has an older permission on file that lets this app change your calendar. Remove Workflow under Third-party access in your Google account, then connect again."
    );
    this.name = "GoogleStaleGrant";
  }
}

const currentUid = () => (auth && auth.currentUser && auth.currentUser.uid) || "";

function readStoredToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved.token !== "string") return null;
    if (!Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now())
      return null;
    // A token belongs to whoever was signed in when it was granted.
    if (saved.uid && saved.uid !== currentUid()) return null;
    return saved.token;
  } catch (e) {
    return null;
  }
}

function storeToken(token) {
  try {
    sessionStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({
        token,
        uid: currentUid(),
        expiresAt: Date.now() + TOKEN_TTL_MS,
      })
    );
  } catch (e) {
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch (e) {
  }
}

export function hasToken() {
  return readStoredToken() !== null;
}

export async function grantedScopes(token) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(
        token
      )}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.scope === "string" ? data.scope.split(" ") : null;
  } catch (e) {
    return null; // Cannot check: let the API call be the judge instead.
  }
}

export async function connect() {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  provider.setCustomParameters({
    prompt: "consent",
    ...(auth && auth.currentUser && auth.currentUser.email
      ? { login_hint: auth.currentUser.email }
      : {}),
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential && credential.accessToken;
  if (!token) throw new GoogleScopeDenied();

  const scopes = await grantedScopes(token);
  if (scopes && scopes.some((scope) => WRITE_SCOPES.includes(scope)))
    throw new GoogleStaleGrant();
  if (scopes && !scopes.includes(CALENDAR_SCOPE)) throw new GoogleScopeDenied();

  storeToken(token);
  return token;
}

async function getToken() {
  const token = readStoredToken();
  if (!token) throw new GoogleAuthRequired();
  return token;
}

const SCOPE_REASONS = new Set([
  "insufficientPermissions",
  "insufficientScopes",
  "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
]);

async function readError(response) {
  try {
    return await response.json();
  } catch (e) {
    return null;
  }
}

function isScopeProblem(payload) {
  const error = payload && payload.error;
  if (!error) return false;
  const reasons = [
    error.status,
    ...(error.errors || []).map((entry) => entry && entry.reason),
    ...(error.details || []).map((entry) => entry && entry.reason),
  ].filter(Boolean);
  if (reasons.some((reason) => SCOPE_REASONS.has(reason))) return true;
  return /insufficient (authentication|permission|scope)/i.test(
    error.message || ""
  );
}

// GET only. There is no method or body to pass.
async function api(path, params) {
  const token = await getToken();
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearToken();
    throw new GoogleAuthRequired();
  }
  // Not an empty calendar: answering with nothing here would empty the cache.
  if (response.status === 404)
    throw new Error(
      "Google could not find that calendar. Pick another one in settings."
    );

  if (!response.ok) {
    const payload = await readError(response);
    const detail = payload?.error?.message || "";

    if (response.status === 403) {
      if (isScopeProblem(payload)) {
        clearToken();
        throw new GoogleScopeDenied();
      }
      throw new Error(
        detail || "Google Calendar refused that request. Check the calendar you picked."
      );
    }

    throw new Error(detail || `Google Calendar request failed (${response.status})`);
  }
  return response.json();
}

export async function listCalendars() {
  const calendars = [];
  let pageToken;

  do {
    // Reader, not writer: school, holiday and subscribed calendars are exactly
    // the ones worth showing, and nothing here needs to write to any of them.
    const data = await api("/users/me/calendarList", {
      minAccessRole: "reader",
      maxResults: 250,
      pageToken,
    });
    (data?.items || []).forEach((entry) =>
      calendars.push({
        id: entry.id,
        name: entry.summaryOverride || entry.summary || entry.id,
        primary: !!entry.primary,
      })
    );
    pageToken = data?.nextPageToken;
  } while (pageToken);

  return calendars;
}

export async function listEvents(calendarId, { timeMin, timeMax } = {}) {
  const events = [];
  let pageToken;

  do {
    // timeMax is not optional. singleEvents expands every repeating series into
    // separate instances, so an unbounded query asks Google for every instance
    // of every recurring event it can generate -- a yearly birthday runs to
    // 2056, a daily event is ~700 rows a year.
    const data = await api(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { maxResults: 250, pageToken, singleEvents: true, timeMin, timeMax }
    );
    (data?.items || []).forEach((event) => events.push(event));
    pageToken = data?.nextPageToken;
  } while (pageToken);

  return { events };
}

// There is deliberately no insertEvent, patchEvent or deleteEvent. This module
// can read a calendar and nothing else.

const pad = (value) => String(value).padStart(2, "0");

function timeOf(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Google's own start or end, kept as the moment it names rather than as a
// clock reading, so each device can show it in its own timezone.
function edgeOf(edge) {
  if (!edge) return null;
  if (typeof edge.date === "string" && DATE_ONLY.test(edge.date))
    return { date: edge.date };
  if (edge.dateTime) {
    const moment = new Date(edge.dateTime);
    if (!Number.isNaN(moment.getTime()))
      return { dateTime: moment.toISOString() };
  }
  return null;
}

/**
 * A Google event as the calendar cache stores it. Deliberately not a work
 * item: these are somebody else's rows, shown for context and never edited,
 * so they carry no class, type, priority or done state.
 *
 * @returns {null|{title,notes,location,recurring,start,end}}
 */
export function eventToCache(event) {
  if (!event || event.status === "cancelled") return null;

  // An assignment the old two-way sync pushed to Google. The work list still
  // has the original, so showing this too would be the same thing twice.
  if (event.extendedProperties?.private?.workflowItemId) return null;

  const start = edgeOf(event.start);
  if (!start) return null;
  const end = edgeOf(event.end);

  return {
    title: event.summary || "Untitled",
    notes: event.description || "",
    location: event.location || "",
    recurring: !!event.recurringEventId,
    start,
    ...(end ? { end } : {}),
  };
}

const unescapeText = (value) =>
  value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");

function unfold(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out = [];
  lines.forEach((line) => {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
      return;
    }
    out.push(line);
  });
  return out;
}

function parseIcsStamp(value, params) {
  const isDateOnly = params.VALUE === "DATE" || /^\d{8}$/.test(value);
  if (isDateOnly) {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (!match) return null;
    return { date: `${match[1]}-${match[2]}-${match[3]}`, time: "" };
  }

  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) return null;

  if (match[7] === "Z") {
    const utc = new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6])
      )
    );
    return { date: toDateKey(utc), time: timeOf(utc) };
  }

  return {
    date: `${match[1]}-${match[2]}-${match[3]}`,
    time: `${match[4]}:${match[5]}`,
  };
}

export function parseIcs(text) {
  const items = [];
  let current = null;

  unfold(text).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {
        uid: "",
        title: "",
        notes: "",
        location: "",
        start: null,
        end: null,
      };
      return;
    }
    if (trimmed === "END:VEVENT") {
      if (current && current.start) {
        const when = {
          mode: "event",
          date: current.start.date,
          time: current.start.time,
          endTime: current.end && current.start.time ? current.end.time : "",
        };
        items.push({
          // One id per occurrence: a repeating series shares a single UID.
          icsUid: `${current.uid || current.title}|${when.date}|${when.time}`,
          title: current.title || "Untitled",
          notes: current.notes,
          location: current.location,
          when,
          type: "",
          priority: DEFAULT_PRIORITY,
          done: false,
        });
      }
      current = null;
      return;
    }
    if (!current) return;

    const separator = line.indexOf(":");
    if (separator === -1) return;
    const rawName = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const [name, ...paramParts] = rawName.split(";");
    const params = {};
    paramParts.forEach((part) => {
      const [key, param] = part.split("=");
      if (key) params[key.toUpperCase()] = param;
    });

    switch (name.toUpperCase()) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.title = unescapeText(value).trim();
        break;
      case "DESCRIPTION":
        current.notes = unescapeText(value).trim();
        break;
      case "LOCATION":
        current.location = unescapeText(value).trim();
        break;
      case "DTSTART":
        current.start = parseIcsStamp(value.trim(), params);
        break;
      case "DTEND":
        current.end = parseIcsStamp(value.trim(), params);
        break;
      default:
        break;
    }
  });

  return items;
}

export async function fetchIcs(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read that feed (${response.status})`);
  return response.text();
}
