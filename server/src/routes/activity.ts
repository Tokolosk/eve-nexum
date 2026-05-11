import { Router } from 'express';

const router = Router();
const ESI = 'https://esi.evetech.net/v1';
const HOUR_MS = 60 * 60 * 1000;
const MAX_HISTORY = 24;
const ESI_CACHE_TTL = 5 * 60 * 1000;

export interface HourlyPoint {
  hour:      number;
  jumps:     number;
  shipKills: number;
  podKills:  number;
  npcKills:  number;
}

interface EsiJump { system_id: number; ship_jumps: number; }
interface EsiKill { system_id: number; ship_kills: number; pod_kills: number; npc_kills: number; }
interface EsiSnapshot {
  jumps:     Map<number, number>;
  kills:     Map<number, EsiKill>;
  fetchedAt: number;
}

const systemHistory  = new Map<number, HourlyPoint[]>();
const trackedSystems = new Set<number>();
let   esiCache: EsiSnapshot | null = null;
let   fetching = false;

function hourFloor(ts = Date.now()): number {
  return ts - (ts % HOUR_MS);
}

async function fetchEsi(): Promise<EsiSnapshot | null> {
  const now = Date.now();
  if (esiCache && now - esiCache.fetchedAt < ESI_CACHE_TTL) return esiCache;
  if (fetching) return esiCache;

  fetching = true;
  try {
    const [jRes, kRes] = await Promise.all([
      fetch(`${ESI}/universe/system_jumps/?datasource=tranquility`),
      fetch(`${ESI}/universe/system_kills/?datasource=tranquility`),
    ]);
    if (!jRes.ok || !kRes.ok) return esiCache;

    const [jumps, kills] = await Promise.all([
      jRes.json() as Promise<EsiJump[]>,
      kRes.json() as Promise<EsiKill[]>,
    ]);

    esiCache = {
      jumps:     new Map(jumps.map((j) => [j.system_id, j.ship_jumps])),
      kills:     new Map(kills.map((k) => [k.system_id, k])),
      fetchedAt: now,
    };
    return esiCache;
  } catch {
    return esiCache;
  } finally {
    fetching = false;
  }
}

async function recordSnapshot(): Promise<void> {
  const snap = await fetchEsi();
  if (!snap) return;

  const hour = hourFloor();
  for (const sysId of trackedSystems) {
    const kll = snap.kills.get(sysId);
    const point: HourlyPoint = {
      hour,
      jumps:     snap.jumps.get(sysId) ?? 0,
      shipKills: kll?.ship_kills ?? 0,
      podKills:  kll?.pod_kills  ?? 0,
      npcKills:  kll?.npc_kills  ?? 0,
    };

    const history = systemHistory.get(sysId) ?? [];
    if (history.length > 0 && history[history.length - 1].hour === hour) {
      history[history.length - 1] = point;
    } else {
      history.push(point);
      if (history.length > MAX_HISTORY) history.shift();
    }
    systemHistory.set(sysId, history);
  }
}

// Poll 1 min after each server-side hour boundary
function scheduleNextPoll() {
  const now   = Date.now();
  const next  = Math.ceil(now / HOUR_MS) * HOUR_MS + 60_000;
  setTimeout(async () => {
    await recordSnapshot();
    scheduleNextPoll();
  }, next - now);
}
scheduleNextPoll();

router.get('/:systemId', async (req, res) => {
  const eveSystemId = parseInt(req.params.systemId, 10);
  if (isNaN(eveSystemId)) { res.status(400).json({ error: 'invalid system id' }); return; }

  trackedSystems.add(eveSystemId);
  await recordSnapshot();

  res.json(systemHistory.get(eveSystemId) ?? []);
});

export default router;
