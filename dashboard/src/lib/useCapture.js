import { useEffect, useMemo, useRef, useState } from "react";
import { captureText } from "./capture/capture";
import { captureTextAsync } from "./capture/async";
import { loadNeuralEncoder } from "./capture/embed";

export function useCapture(text, options = {}) {
  const { spaces, memory, neural } = options;

  const base = useMemo(
    () => captureText(text, { spaces, memory }),
    [text, spaces, memory]
  );

  const [refined, setRefined] = useState(null);
  const [neuralState, setNeuralState] = useState("idle");
  const requestId = useRef(0);

  useEffect(() => {
    if (!neural || text.trim() === "") {
      setRefined(null);
      return undefined;
    }

    let alive = true;
    const id = requestId.current + 1;
    requestId.current = id;
    setNeuralState((current) => (current === "ready" ? "ready" : "loading"));

    loadNeuralEncoder()
      .then((encoder) => {
        if (!alive) return null;
        setNeuralState("ready");
        return captureTextAsync(text, { spaces, memory, encoder });
      })
      .then((result) => {
        if (alive && result && requestId.current === id) setRefined(result);
      })
      .catch(() => {
        if (alive) setNeuralState("error");
      });

    return () => {
      alive = false;
    };
  }, [text, spaces, memory, neural]);

  useEffect(() => setRefined(null), [text]);

  return { parsed: refined || base, neuralState };
}
