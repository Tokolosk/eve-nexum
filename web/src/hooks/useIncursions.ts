import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface IncursionSystem {
  systemId:       number;
  factionId:      number;
  factionName:    string;
  factionLogoUrl: string;
  state:          string;
  influence:      number;
  hasBoss:        boolean;
  isStaging:      boolean;
}

const POLL_MS = 60 * 60 * 1000;

let moduleCache: { data: IncursionSystem[]; fetchedAt: number } | null = null;

export function useIncursions() {
  const [data, setData] = useState<IncursionSystem[]>(moduleCache?.data ?? []);

  useEffect(() => {
    const now = Date.now();
    if (moduleCache && now - moduleCache.fetchedAt < POLL_MS) {
      setData(moduleCache.data);
      return;
    }

    const load = () =>
      api<IncursionSystem[]>('/api/incursions')
        .then((d) => { moduleCache = { data: d, fetchedAt: Date.now() }; setData(d); })
        .catch(() => {});

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return data;
}

export function findIncursion(incursions: IncursionSystem[], eveSystemId: number | null): IncursionSystem | undefined {
  if (!eveSystemId) return undefined;
  return incursions.find((i) => i.systemId === eveSystemId);
}
