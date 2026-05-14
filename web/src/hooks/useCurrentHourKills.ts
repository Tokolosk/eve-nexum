import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface SystemKills {
  systemId:  number;
  shipKills: number;
  podKills:  number;
  npcKills:  number;
}

const POLL_MS = 5 * 60 * 1000;
const EMPTY = new Map<number, SystemKills>();

let cache: Map<number, SystemKills> = EMPTY;
let cacheAt = 0;
let inflight: Promise<Map<number, SystemKills>> | null = null;
const subscribers = new Set<(d: Map<number, SystemKills>) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function notify(d: Map<number, SystemKills>) {
  subscribers.forEach(fn => fn(d));
}

function load() {
  if (inflight) return inflight;
  inflight = api<SystemKills[]>('/api/activity/current-kills')
    .then(rows => {
      cache = new Map(rows.map(r => [r.systemId, r]));
      cacheAt = Date.now();
      inflight = null;
      notify(cache);
      return cache;
    })
    .catch(() => { inflight = null; return cache; });
  return inflight;
}

export function useCurrentHourKills(): Map<number, SystemKills> {
  const [data, setData] = useState<Map<number, SystemKills>>(cache);

  useEffect(() => {
    subscribers.add(setData);
    if (cache === EMPTY || Date.now() - cacheAt >= POLL_MS) load();
    else setData(cache);
    if (!pollTimer) pollTimer = setInterval(load, POLL_MS);
    return () => {
      subscribers.delete(setData);
      if (subscribers.size === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }, []);

  return data;
}
