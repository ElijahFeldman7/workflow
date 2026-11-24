import { useCallback, useEffect, useRef, useState } from "react";
import { readLegacyGradebook } from "./studentvueLegacy";

const refreshInterval = 5 * 60 * 1000;
const requestTimeout = 15000;
const reconnectKey = "studentVueReconnect";

export function shouldReconnectGrades(uid) {
  try {
    return Boolean(uid && localStorage.getItem(reconnectKey) === uid);
  } catch {
    return false;
  }
}

export function rememberGradeConnection(uid, connected) {
  if (!uid) return;
  try {
    if (connected) localStorage.setItem(reconnectKey, uid);
    else if (shouldReconnectGrades(uid)) localStorage.removeItem(reconnectKey);
  } catch {
    // The current page can still connect when browser storage is unavailable.
  }
}

export function useLegacyGrades({ active, onResult }) {
  const credentials = useRef(null);
  const pending = useRef(null);
  const nextRefresh = useRef(0);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const disconnect = useCallback(() => {
    credentials.current = null;
    pending.current?.abort();
    pending.current = null;
    setConnected(false);
    setBusy(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!credentials.current || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    nextRefresh.current = Date.now() + refreshInterval;
    const timeout = setTimeout(() => controller.abort(), requestTimeout);
    let result;
    try {
      result = await readLegacyGradebook(credentials.current, controller.signal);
    } catch {
      result = { status: "legacy-unavailable" };
    } finally {
      clearTimeout(timeout);
    }
    if (pending.current !== controller) return;
    pending.current = null;
    setBusy(false);

    if (result.status === "ok") {
      setConnected(true);
    } else if (result.status !== "legacy-unavailable" || !connected) {
      disconnect();
    }
    onResult(result);
  }, [connected, disconnect, onResult]);

  const connect = (username, password) => {
    if (pending.current) return;
    credentials.current = { username, password };
    void refresh();
  };

  useEffect(() => {
    if (!connected || !active) return;
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") return;
        void refresh();
        // An explicit refresh can already be running when this timer fires.
        schedule();
      }, Math.max(1000, nextRefresh.current - Date.now()));
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [active, connected, refresh]);

  useEffect(() => () => {
    credentials.current = null;
    pending.current?.abort();
    pending.current = null;
  }, []);

  return { connect, connected, busy, refresh, disconnect };
}
