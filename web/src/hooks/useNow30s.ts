import { useEffect, useState } from 'react';

// Module-level 30-second ticker shared by every subscriber. Drives the live
// EOL countdown labels on connections and the stale-system fade — both want
// the same cadence and would otherwise create one timer per node.

const subscribers = new Set<(t: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  const now = Date.now();
  subscribers.forEach((fn) => fn(now));
}

export function useNow30s(): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    subscribers.add(setNow);
    if (!timer) timer = setInterval(tick, 30_000);
    return () => {
      subscribers.delete(setNow);
      if (subscribers.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);

  return now;
}
