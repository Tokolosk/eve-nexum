import { useEffect, useState } from 'react';

const ESI = 'https://esi.evetech.net/latest';

interface EsiPlanet {
  planet_id: number;
  moons?: number[];
  asteroid_belts?: number[];
}

export interface EsiSystemData {
  stationIds:        number[];
  planetCount:       number;
  moonCount:         number;
  stargateCount:     number;
  securityStatus:    number | null;
  constellationName: string | null;
}

// Static reference data — no TTL needed; a page refresh recovers from any CCP patch.
const cache = new Map<number, EsiSystemData>();
// Track in-flight requests so concurrent callers share one fetch, not N.
const inflight = new Map<number, Promise<EsiSystemData>>();

const constellationCache = new Map<number, string>();

async function fetchConstellationName(constellationId: number): Promise<string | null> {
  const cached = constellationCache.get(constellationId);
  if (cached) return cached;
  try {
    const res = await fetch(`${ESI}/universe/constellations/${constellationId}/`);
    if (!res.ok) return null;
    const data = await res.json() as { name: string };
    constellationCache.set(constellationId, data.name);
    return data.name;
  } catch {
    return null;
  }
}

async function loadSystem(eveSystemId: number): Promise<EsiSystemData> {
  const cached = cache.get(eveSystemId);
  if (cached) return cached;

  const existing = inflight.get(eveSystemId);
  if (existing) return existing;

  const promise = (async (): Promise<EsiSystemData> => {
    try {
      const res = await fetch(`${ESI}/universe/systems/${eveSystemId}/`);
      if (!res.ok) return { stationIds: [], planetCount: 0, moonCount: 0, stargateCount: 0, securityStatus: null, constellationName: null };
      const data = await res.json() as {
        stations?: number[];
        planets?: EsiPlanet[];
        stargates?: number[];
        security_status?: number;
        constellation_id?: number;
      };
      const constellationName = data.constellation_id
        ? await fetchConstellationName(data.constellation_id)
        : null;
      const result: EsiSystemData = {
        stationIds:        data.stations ?? [],
        planetCount:       data.planets?.length ?? 0,
        moonCount:         data.planets?.reduce((n, p) => n + (p.moons?.length ?? 0), 0) ?? 0,
        stargateCount:     data.stargates?.length ?? 0,
        securityStatus:    data.security_status ?? null,
        constellationName,
      };
      cache.set(eveSystemId, result);
      return result;
    } finally {
      inflight.delete(eveSystemId);
    }
  })();

  inflight.set(eveSystemId, promise);
  return promise;
}

export function useEsiSystem(eveSystemId: number | null) {
  const [data, setData] = useState<EsiSystemData | null>(() =>
    eveSystemId ? (cache.get(eveSystemId) ?? null) : null,
  );

  useEffect(() => {
    if (!eveSystemId) { setData(null); return; }
    const hit = cache.get(eveSystemId);
    if (hit) { setData(hit); return; }
    loadSystem(eveSystemId).then(setData).catch(() => {});
  }, [eveSystemId]);

  return data;
}

// For components that only need the station IDs (NpcStationsPane).
export { loadSystem };
