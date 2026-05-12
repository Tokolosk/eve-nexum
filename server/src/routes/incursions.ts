import { Router } from 'express';

const router = Router();

interface EsiFaction {
  faction_id: number;
  name: string;
  corporation_id?: number;
}

interface EsiIncursion {
  constellation_id:       number;
  faction_id:             number;
  has_boss:               boolean;
  infested_solar_systems: number[];
  influence:              number;
  staging_solar_system_id: number;
  state:                  string;
  type:                   string;
}

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

const CACHE_TTL_MS = 60 * 60 * 1000;

let factionMap: Map<number, EsiFaction> | null = null;
let cachedAt   = 0;
let cachedData: IncursionSystem[] = [];

async function loadFactions(): Promise<Map<number, EsiFaction>> {
  if (factionMap) return factionMap;
  const res = await fetch('https://esi.evetech.net/latest/universe/factions/?datasource=tranquility');
  if (!res.ok) throw new Error(`ESI factions ${res.status}`);
  const list = await res.json() as EsiFaction[];
  factionMap = new Map(list.map((f) => [f.faction_id, f]));
  return factionMap;
}

async function fetchAndBuild(): Promise<IncursionSystem[]> {
  const [incRes, factions] = await Promise.all([
    fetch('https://esi.evetech.net/latest/incursions/?datasource=tranquility'),
    loadFactions(),
  ]);
  if (!incRes.ok) throw new Error(`ESI incursions ${incRes.status}`);

  const incursions = await incRes.json() as EsiIncursion[];
  const result: IncursionSystem[] = [];

  for (const inc of incursions) {
    const faction = factions.get(inc.faction_id);
    const factionName    = faction?.name ?? 'Unknown';
    const factionLogoUrl = faction?.corporation_id
      ? `https://images.evetech.net/corporations/${faction.corporation_id}/logo?size=64`
      : '';

    for (const sysId of inc.infested_solar_systems) {
      result.push({
        systemId:       sysId,
        factionId:      inc.faction_id,
        factionName,
        factionLogoUrl,
        state:          inc.state,
        influence:      inc.influence,
        hasBoss:        inc.has_boss,
        isStaging:      sysId === inc.staging_solar_system_id,
      });
    }
  }
  return result;
}

router.get('/', async (_req, res) => {
  const now = Date.now();
  if (now - cachedAt < CACHE_TTL_MS) {
    res.json(cachedData);
    return;
  }
  try {
    cachedData = await fetchAndBuild();
    cachedAt   = now;
    res.json(cachedData);
  } catch (err) {
    console.error('Incursions fetch failed:', err);
    if (cachedData.length) { res.json(cachedData); return; }
    res.status(502).json({ error: 'Failed to fetch incursions' });
  }
});

export default router;
