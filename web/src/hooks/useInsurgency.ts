import { useEffect, useState } from 'react';
import { api } from '../api/client';

export interface InsurgencySystem {
  systemId:         number;
  campaignId:       number;
  factionId:        number;
  factionName:      string;
  factionLogoUrl:   string;
  corruptionPct:    number;
  corruptionState:  number;
  suppressionPct:   number;
  suppressionState: number;
}

const POLL_MS = 60 * 60 * 1000;

let moduleCache: { data: InsurgencySystem[]; fetchedAt: number } | null = null;

export function useInsurgency() {
  const [data, setData] = useState<InsurgencySystem[]>(moduleCache?.data ?? []);

  useEffect(() => {
    const now = Date.now();
    if (moduleCache && now - moduleCache.fetchedAt < POLL_MS) {
      setData(moduleCache.data);
      return;
    }

    const load = () =>
      api<InsurgencySystem[]>('/api/insurgency')
        .then((d) => { moduleCache = { data: d, fetchedAt: Date.now() }; setData(d); })
        .catch(() => {});

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return data;
}

export function findInsurgency(insurgencies: InsurgencySystem[], eveSystemId: number | null): InsurgencySystem | undefined {
  if (!eveSystemId) return undefined;
  return insurgencies.find((i) => i.systemId === eveSystemId);
}
