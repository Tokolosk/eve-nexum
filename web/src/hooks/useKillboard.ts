import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export interface ZkbKill {
  killmail_id: number;
  killmail_time: string;
  victim: {
    character_id?:   number;
    corporation_id?: number;
    alliance_id?:    number;
    ship_type_id:    number;
  };
  attackers: Array<{
    character_id?:   number;
    corporation_id?: number;
    alliance_id?:    number;
    final_blow:      boolean;
  }>;
  zkb: {
    hash: string;
    totalValue: number;
    solo: boolean;
    npc: boolean;
  };
}

interface CacheEntry {
  kills: ZkbKill[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const clientCache = new Map<number, CacheEntry>();

export function useKillboard(eveSystemId: number | null) {
  const [kills, setKills]           = useState<ZkbKill[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!eveSystemId) {
      setKills([]);
      setError(null);
      setLastUpdated(null);
      return;
    }

    cancelledRef.current = false;

    async function fetchKills() {
      const now = Date.now();
      const cached = clientCache.get(eveSystemId!);
      if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        setKills(cached.kills);
        setLastUpdated(new Date(cached.fetchedAt));
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await api<ZkbKill[]>(`/api/killboard/${eveSystemId}`);
        if (cancelledRef.current) return;
        clientCache.set(eveSystemId!, { kills: data, fetchedAt: Date.now() });
        setKills(data);
        setLastUpdated(new Date());
      } catch {
        if (!cancelledRef.current) setError('Could not load kill data');
      } finally {
        if (!cancelledRef.current) setLoading(false);
      }
    }

    fetchKills();
    const interval = setInterval(fetchKills, CACHE_TTL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [eveSystemId]);

  return { kills, loading, error, lastUpdated };
}
