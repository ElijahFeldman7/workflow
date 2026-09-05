import { useCallback, useEffect, useState } from "react";
import { ref, onValue, update } from "firebase/database";
import { database } from "../firebase";
import {
  emptyMemory,
  memoryKey,
  normalizeMemory,
  recordCorrection,
} from "./capture/memory";

const memoryPath = (uid) => `users/${uid}/captureMemory`;

export function useCaptureMemory(user) {
  const [memory, setMemory] = useState(emptyMemory);

  useEffect(() => {
    if (!user) {
      setMemory(emptyMemory());
      return undefined;
    }
    return onValue(
      ref(database, memoryPath(user.uid)),
      (snapshot) => setMemory(normalizeMemory(snapshot.val())),
      () => setMemory(emptyMemory())
    );
  }, [user]);

  const learn = useCallback(
    async (phrase, field, value) => {
      const key = memoryKey(phrase, field);
      if (!key || !value) return;

      const next = recordCorrection(memory, phrase, field, value);
      setMemory(next);
      if (!user) return;

      try {
        await update(ref(database, memoryPath(user.uid)), { [key]: next[key] });
      } catch (err) {
        setMemory(next);
      }
    },
    [memory, user]
  );

  return { memory, learn };
}
