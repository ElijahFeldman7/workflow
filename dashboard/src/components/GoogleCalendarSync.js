import React, { useState } from "react";
import { useWorkData } from "../lib/useWorkData";
import { useGoogleSync } from "../lib/useGoogleSync";
import { parseIcs, fetchIcs } from "../lib/googleCalendar";

const looksLikeUrl = (value) => /^https?:\/\//i.test(value.trim());

const relative = (stamp) => {
  if (!stamp) return "never";
  const seconds = Math.round((Date.now() - stamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(stamp).toLocaleDateString();
};

const Switch = ({ on, onClick, label }) => (
  <button
    onClick={onClick}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      on ? "bg-primary" : "bg-muted-foreground/40"
    }`}
    role="switch"
    aria-checked={on}
    aria-label={label}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        on ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

const GoogleCalendarSync = ({ user }) => {
  const { items, isLoading } = useWorkData(user);
  const sync = useGoogleSync(user, items, !isLoading);

  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const runImport = async () => {
    const value = paste.trim();
    if (!value) return;
    setImporting(true);
    setImportMessage("");
    try {
      const text = looksLikeUrl(value) ? await fetchIcs(value) : value;
      const parsed = parseIcs(text);
      if (parsed.length === 0) {
        setImportMessage("No events found in that calendar file.");
      } else {
        const count = await sync.importItems(parsed);
        setImportMessage(`Imported ${count} event${count === 1 ? "" : "s"}.`);
        setPaste("");
      }
    } catch (err) {
      setImportMessage(
        looksLikeUrl(value)
          ? "That address could not be read from the browser. Open it, then paste the file's contents here instead."
          : err?.message || "Could not read that calendar file."
      );
    } finally {
      setImporting(false);
    }
  };

  const button =
    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <section className="mb-8">
      <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
        Google Calendar
      </h3>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {sync.connected ? "Connected" : "Not connected"}
            </p>
            <p className="text-sm text-muted-foreground">
              {sync.connected
                ? `Syncing ${sync.config.calendarName || sync.config.calendarId} both ways · last synced ${relative(
                    sync.config.lastSyncedAt
                  )}`
                : "Sign in with Google to keep this calendar and your work in step, both directions."}
            </p>
          </div>

          <div className="flex-shrink-0 flex gap-2">
            {sync.connected && !sync.needsAuth && (
              <>
                <button
                  onClick={sync.syncNow}
                  disabled={sync.status === "syncing"}
                  className={`${button} bg-muted text-foreground hover:bg-muted/70`}
                >
                  {sync.status === "syncing" ? "Syncing..." : "Sync now"}
                </button>
                <button
                  onClick={sync.resync}
                  disabled={sync.status === "syncing"}
                  title="Re-read the whole calendar: clears duplicates and events deleted in Google"
                  className={`${button} text-muted-foreground hover:bg-muted/40`}
                >
                  Full resync
                </button>
              </>
            )}
            {sync.connected && !sync.needsAuth ? (
              <button
                onClick={sync.disconnectGoogle}
                className={`${button} text-red-500 dark:text-red-400 hover:bg-muted/40`}
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={sync.connectGoogle}
                disabled={sync.status === "connecting"}
                className={`${button} bg-primary text-primary-foreground hover:bg-primary/85`}
              >
                {sync.status === "connecting"
                  ? "Connecting..."
                  : sync.needsAuth && sync.connected
                  ? "Reconnect"
                  : "Connect Google"}
              </button>
            )}
          </div>
        </div>

        {sync.message && (
          <p
            className={`text-sm ${
              sync.status === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {sync.message}
          </p>
        )}

        {sync.connected && !sync.needsAuth && (
          <>
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Calendar</p>
                <p className="text-sm text-muted-foreground">
                  Which calendar to read from and write to
                </p>
              </div>
              <select
                value={sync.config.calendarId}
                onChange={(e) => sync.chooseCalendar(e.target.value)}
                className="rounded-md border border-border bg-background text-foreground px-3 py-1.5 text-sm max-w-[14rem] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {sync.calendars.length === 0 && (
                  <option value={sync.config.calendarId}>
                    {sync.config.calendarName || sync.config.calendarId}
                  </option>
                )}
                {sync.calendars.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Sync automatically
                </p>
                <p className="text-sm text-muted-foreground">
                  Check for changes every few minutes while the app is open
                </p>
              </div>
              <Switch
                on={sync.config.autoSync}
                onClick={() => sync.setAutoSync(!sync.config.autoSync)}
                label="Sync automatically"
              />
            </div>
          </>
        )}

        <div className="pt-2 border-t border-border">
          <button
            onClick={() => setShowPaste(!showPaste)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPaste ? "Hide" : "Or paste a calendar file (.ics)"}
          </button>

          {showPaste && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Paste the contents of an .ics file, or its address. This is a
                one-time import: an .ics feed is read-only, so nothing syncs
                back to it. Connect with Google above for two-way sync.
              </p>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                placeholder="BEGIN:VCALENDAR&#10;..."
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={runImport}
                  disabled={importing || paste.trim() === ""}
                  className={`${button} bg-primary text-primary-foreground hover:bg-primary/85`}
                >
                  {importing ? "Importing..." : "Import events"}
                </button>
                {importMessage && (
                  <span className="text-sm text-muted-foreground">
                    {importMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default GoogleCalendarSync;
