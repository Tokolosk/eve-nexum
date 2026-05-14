import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface WormholeSpec {
  totalMass:     number;
  maxJumpMass:   number;
  massRegen:     number;
  lifetimeHours: number;
  dest:          string;
  src:           string[];
}

type WhMap = Record<string, WormholeSpec>;

// Static cluster data — load once per page, never refresh.
let cache: WhMap | null = null;
let inflight: Promise<WhMap> | null = null;
const EMPTY: WhMap = {};

function load(): Promise<WhMap> {
  if (cache)    return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = api<WhMap>('/api/wormholes/types')
    .then(rows => { cache = rows; inflight = null; return cache; })
    .catch(() => { inflight = null; return cache ?? EMPTY; });
  return inflight;
}

export function useWormholeTypes(): WhMap {
  const [data, setData] = useState<WhMap>(cache ?? EMPTY);

  useEffect(() => {
    if (cache) { setData(cache); return; }
    let cancelled = false;
    load().then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  return data;
}
