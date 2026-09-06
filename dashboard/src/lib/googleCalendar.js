import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase";
import {
  DEFAULT_PRIORITY,
  PRIORITY_IDS,
  WORK_TYPE_IDS,
  isDateKey,
  isTimeValue,
  addDaysKey,
  fromDateKey,
  toDateKey,
} from "../constants/work";

// Read-only, permanently. There is no write scope here to ask for, so Google
// itself refuses any attempt to change a calendar regardless of what this code
// does. Writing was removed after a sync deleted events people had been
// invited to, which Google reports to the organiser as a decline.
export const CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";
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
        "Calendar permission was not granted. Connect again and tick the calendar checkbox on Google's consent screen — the app cannot read or write your calendar without it."
    );
    this.name = "GoogleScopeDenied";
  }
}

export class SyncTokenExpired extends Error {
  constructor() {
    super("Sync token expired");
    this.name = "SyncTokenExpired";
  }
}

export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {
    return "UTC";
  }
}

function readStoredToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved.token !== "string") return null;
    if (!Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now())
      return null;
    return saved.token;
  } catch (e) {
    return null;
  }
}

function storeToken(token) {
  try {
    sessionStorage.setItem(
      TOKEN_KEY,
      JSON.stringify({ token, expiresAt: Date.now() + TOKEN_TTL_MS })
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
    include_granted_scopes: "true",
    ...(auth && auth.currentUser && auth.currentUser.email
      ? { login_hint: auth.currentUser.email }
      : {}),
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential && credential.accessToken;
  if (!token) throw new GoogleScopeDenied();

  const scopes = await grantedScopes(token);
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

async function api(path, { method = "GET", params, body, goneIsNull } = {}) {
  const token = await getToken();
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearToken();
    throw new GoogleAuthRequired();
  }
  if (response.status === 410) {
    if (goneIsNull) return null;
    throw new SyncTokenExpired();
  }
  if (response.status === 404) return null;
  if (response.status === 204) return {};

  if (!response.ok) {
    const payload = await readError(response);
    const detail = payload?.error?.message || "";

    // Google rejects a sync token whose query no longer matches with a 400,
    // not a 410. Both mean the same thing: start over with a full sync.
    if (response.status === 400 && /sync ?token/i.test(detail))
      throw new SyncTokenExpired();

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
  const data = await api("/users/me/calendarList", {
    params: { minAccessRole: "writer", maxResults: 250 },
  });
  return (data?.items || []).map((entry) => ({
    id: entry.id,
    name: entry.summaryOverride || entry.summary || entry.id,
    primary: !!entry.primary,
    readOnly: entry.accessRole !== "writer" && entry.accessRole !== "owner",
  }));
}

export async function listEvents(
  calendarId,
  { syncToken, timeMin, timeMax } = {}
) {
  const events = [];
  let pageToken;
  let nextSyncToken;

  do {
    // A sync token is only valid for the exact query that produced it, so both
    // paths must match. showDeleted is what carries a deletion back to us.
    //
    // timeMax is not optional. singleEvents expands every repeating series into
    // separate instances, so an unbounded query asks Google for every instance
    // of every recurring event it can generate -- a yearly birthday runs to
    // 2056, a daily event is ~700 rows a year.
    const params = {
      maxResults: 250,
      pageToken,
      singleEvents: true,
      showDeleted: true,
      ...(syncToken ? { syncToken } : { timeMin, timeMax }),
    };
    const data = await api(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { params }
    );
    (data?.items || []).forEach((event) => events.push(event));
    pageToken = data?.nextPageToken;
    nextSyncToken = data?.nextSyncToken || nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}

export function getEvent(calendarId, eventId) {
  return api(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(
      eventId
    )}`,
    { goneIsNull: true }
  );
}

// There is deliberately no insertEvent, patchEvent or deleteEvent. This module
// can read a calendar and nothing else.

const pad = (value) => String(value).padStart(2, "0");

function timeOf(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function itemToEvent(item, timeZone) {
  const resource = {
    summary: item.title,
    description: item.notes || "",
    location: item.location || "",
    extendedProperties: {
      private: {
        workflowMode: item.when.mode,
        workflowType: item.type || "",
        workflowPriority: item.priority || "",
        workflowDone: item.done ? "1" : "0",
        workflowSpaceId: item.spaceId || "",
        // Lets a sync re-adopt this event when the local link record is gone,
        // instead of inserting a second copy of it.
        workflowItemId: item.id || "",
      },
    },
  };

  const { date, time, endTime } = item.when;
  if (!isDateKey(date)) return null;

  if (!isTimeValue(time)) {
    resource.start = { date };
    resource.end = { date: addDaysKey(date, 1) };
    return resource;
  }

  const [startHour, startMinute] = time.split(":").map(Number);
  const start = fromDateKey(date);
  start.setHours(startHour, startMinute, 0, 0);

  const end = new Date(start.getTime());
  if (isTimeValue(endTime)) {
    const [endHour, endMinute] = endTime.split(":").map(Number);
    end.setHours(endHour, endMinute, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
  } else {
    end.setMinutes(end.getMinutes() + 60);
  }

  const stamp = (value) =>
    `${toDateKey(value)}T${timeOf(value)}:00`;

  resource.start = { dateTime: stamp(start), timeZone };
  resource.end = { dateTime: stamp(end), timeZone };
  return resource;
}

/**
 * A Google event as the calendar cache stores it. Deliberately not a work
 * item: these are somebody else's rows, shown for context and never edited,
 * so they carry no class, type, priority or done state.
 *
 * @returns {null|{title,notes,location,allDay,recurring,when}}
 */
export function eventToCache(event) {
  if (!event || event.status === "cancelled") return null;

  const when = { mode: "event", date: "", time: "", endTime: "" };
  let allDay = false;

  if (event.start?.date) {
    when.date = event.start.date;
    allDay = true;
  } else if (event.start?.dateTime) {
    const start = new Date(event.start.dateTime);
    if (Number.isNaN(start.getTime())) return null;
    when.date = toDateKey(start);
    when.time = timeOf(start);
    if (event.end?.dateTime) {
      const end = new Date(event.end.dateTime);
      if (!Number.isNaN(end.getTime())) when.endTime = timeOf(end);
    }
  } else {
    return null;
  }

  return {
    title: event.summary || "Untitled",
    notes: event.description || "",
    location: event.location || "",
    allDay,
    recurring: !!event.recurringEventId,
    when,
  };
}

export function workflowIdOf(event) {
  const stored = event?.extendedProperties?.private || {};
  return typeof stored.workflowItemId === "string" ? stored.workflowItemId : "";
}

export function eventToItem(event) {
  const stored = event.extendedProperties?.private || {};
  const when = { mode: "event", date: "", time: "", endTime: "" };

  if (event.start?.date) {
    when.date = event.start.date;
  } else if (event.start?.dateTime) {
    const start = new Date(event.start.dateTime);
    if (Number.isNaN(start.getTime())) return null;
    when.date = toDateKey(start);
    when.time = timeOf(start);
    if (event.end?.dateTime) {
      const end = new Date(event.end.dateTime);
      if (!Number.isNaN(end.getTime())) when.endTime = timeOf(end);
    }
  } else {
    return null;
  }

  if (stored.workflowMode === "due") when.mode = "due";

  return {
    title: event.summary || "Untitled",
    notes: event.description || "",
    location: event.location || "",
    when,
    type: WORK_TYPE_IDS.includes(stored.workflowType) ? stored.workflowType : "",
    priority: PRIORITY_IDS.includes(stored.workflowPriority)
      ? stored.workflowPriority
      : DEFAULT_PRIORITY,
    done: stored.workflowDone === "1",
  };
}

export function fingerprint(item) {
  return [
    item.title,
    item.notes || "",
    item.location || "",
    item.when.mode,
    item.when.date,
    item.when.time,
    item.when.endTime,
    item.type || "",
    item.priority || "",
    item.done ? "1" : "0",
  ].join(" ");
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
      current = { title: "", notes: "", location: "", start: null, end: null };
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
