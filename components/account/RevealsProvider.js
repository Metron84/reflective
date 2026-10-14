"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const RevealsContext = createContext({ revealed: [], reveal: () => {} });

/**
 * Crest league reveals, shared by the Crest tile and Next up. The server owns the
 * state (crest_reveals); a tap updates the screen at once and saves in the background.
 * If the save fails the league stays revealed for this visit.
 *
 * @param {{initial: string[], children: import("react").ReactNode}} props
 */
export default function RevealsProvider({ initial, children }) {
  const [revealed, setRevealed] = useState(initial);

  const reveal = useCallback(
    (competition) => {
      if (revealed.includes(competition)) return;
      setRevealed([...revealed, competition]);
      fetch("/api/crest/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competition }),
      }).catch(() => {});
    },
    [revealed]
  );

  const value = useMemo(() => ({ revealed, reveal }), [revealed, reveal]);
  return <RevealsContext.Provider value={value}>{children}</RevealsContext.Provider>;
}

export function useReveals() {
  return useContext(RevealsContext);
}
