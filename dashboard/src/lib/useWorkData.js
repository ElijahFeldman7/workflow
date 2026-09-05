import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../firebase";
import { normalizeItem, normalizeSpace } from "../constants/work";

export function useWorkData(user) {
  const [spaces, setSpaces] = useState([]);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    const unsubscribeSpaces = onValue(
      ref(database, `users/${user.uid}/spaces`),
      (snapshot) => {
        const data = snapshot.val();
        const loaded = data
          ? Object.entries(data).map(([key, value]) => normalizeSpace(key, value))
          : [];
        loaded.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
        setSpaces(loaded);
      },
      (err) => setError(err?.message || "Failed to load classes")
    );

    const unsubscribeItems = onValue(
      ref(database, `users/${user.uid}/work`),
      (snapshot) => {
        const data = snapshot.val();
        setItems(
          data
            ? Object.entries(data).map(([key, value]) => normalizeItem(key, value))
            : []
        );
        setIsLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load work");
        setIsLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribeSpaces === "function") unsubscribeSpaces();
      if (typeof unsubscribeItems === "function") unsubscribeItems();
    };
  }, [user]);

  const spaceById = useMemo(() => {
    const map = new Map();
    spaces.forEach((space) => map.set(space.id, space));
    return map;
  }, [spaces]);

  const activeSpaces = useMemo(
    () => spaces.filter((space) => !space.archived),
    [spaces]
  );

  return { spaces, activeSpaces, spaceById, items, isLoading, error, setError };
}
