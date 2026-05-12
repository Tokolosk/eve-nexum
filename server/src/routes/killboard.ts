import { Router } from 'express';

const router = Router();

const ZKB_AGENT    = 'Eve-Nexum/1.0 (https://github.com/area404/eve-nexum; gq@area404.org)';
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_KILLS    = 25;
const FETCH_TIMEOUT_MS = 8_000;

interface ZkbEntry {
  killmail_id: number;
  zkb: {
    hash:       string;
    totalValue: number;
    solo:       boolean;
    npc:        boolean;
  };
}

interface EsiKillmail {
  killmail_id:   number;
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
}

export interface KillEntry {
  killmail_id:   number;
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
  zkb: ZkbEntry['zkb'];
}

interface CacheEntry {
  data:      KillEntry[];
  fetchedAt: number;
  etag?:     string;
}

const cache = new Map<string, CacheEntry>();

// Evict entries older than 2× TTL
setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL_MS * 2;
  for (const [key, entry] of cache) {
    if (entry.fetchedAt < cutoff) cache.delete(key);
  }
}, 15 * 60 * 1000);

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function fetchEsi(killmailId: number, hash: string): Promise<EsiKillmail | null> {
  try {
    const res = await fetch(
      `https://esi.evetech.net/latest/killmails/${killmailId}/${hash}/`,
      { headers: { 'User-Agent': ZKB_AGENT, Accept: 'application/json' }, signal: withTimeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) return null;
    return (await res.json()) as EsiKillmail;
  } catch {
    return null;
  }
}

router.get('/:systemId(\\d+)', async (req, res) => {
  const { systemId } = req.params;
  const now = Date.now();

  const cached = cache.get(systemId);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return res.json(cached.data);
  }

  // zKillboard: kills in the past 24 h, NPC kills excluded
  const zkbUrl = `https://zkillboard.com/api/kills/npc/0/solarSystemID/${systemId}/pastSeconds/86400/`;
  const zkbHeaders: Record<string, string> = {
    'User-Agent': ZKB_AGENT,
    Accept:       'application/json',
  };
  if (cached?.etag) zkbHeaders['If-None-Match'] = cached.etag;

  try {
    const zkbRes = await fetch(zkbUrl, { headers: zkbHeaders, signal: withTimeout(FETCH_TIMEOUT_MS) });

    // zKillboard says nothing changed — bump TTL and return cached data
    if (zkbRes.status === 304 && cached) {
      cache.set(systemId, { ...cached, fetchedAt: now });
      return res.json(cached.data);
    }

    if (!zkbRes.ok) {
      if (cached) return res.json(cached.data);
      console.warn(`[killboard] zKillboard returned ${zkbRes.status} for system ${systemId}`);
      return res.json([]);
    }

    const zkbBody = (await zkbRes.json()) as ZkbEntry[];

    if (!Array.isArray(zkbBody)) {
      if (cached) return res.json(cached.data);
      console.warn(`[killboard] Unexpected response from zKillboard for system ${systemId}`);
      return res.json([]);
    }

    const limited = zkbBody.slice(0, MAX_KILLS);
    const etag    = zkbRes.headers.get('etag') ?? undefined;

    // Fetch full killmail details from ESI in parallel
    const esiResults = await Promise.all(
      limited.map((k) => fetchEsi(k.killmail_id, k.zkb.hash)),
    );

    const kills = limited
      .map((zkb, i) => {
        const esi = esiResults[i];
        if (!esi) return null;
        const entry: KillEntry = {
          killmail_id:   esi.killmail_id,
          killmail_time: esi.killmail_time,
          victim:        esi.victim,
          // Only store what we render to keep the cache lean
          attackers: esi.attackers.map((a) => ({
            character_id:   a.character_id,
            corporation_id: a.corporation_id,
            alliance_id:    a.alliance_id,
            final_blow:     a.final_blow,
          })),
          zkb: zkb.zkb,
        };
        return entry;
      })
      .filter((k): k is KillEntry => k !== null);

    cache.set(systemId, { data: kills, fetchedAt: now, etag });
    return res.json(kills);
  } catch (err) {
    console.warn(`[killboard] Failed to reach zKillboard for system ${systemId}:`, (err as Error).message);
    if (cached) return res.json(cached.data);
    return res.json([]);
  }
});

export default router;
