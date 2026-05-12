import { Router } from 'express';

const router = Router();

interface EsiFaction {
  faction_id:     number;
  name:           string;
  corporation_id?: number;
}

interface SolarSystemEntry {
  id:              number;
  name:            string;
  security:        number;
  securityBand:    string;
  ownerFactionId:  number;
  occupierFactionId: number | null;
}

interface InsurgencyEntry {
  corruptionDate:        string | null;
  corruptionPercentage:  number;
  corruptionState:       number;
  suppressionDate:       string | null;
  suppressionPercentage: number;
  suppressionState:      number;
  solarSystem:           SolarSystemEntry;
}

interface Campaign {
  campaignId:     number;
  pirateFactionId: number;
  state:          string;
  insurgencies:   InsurgencyEntry[];
}

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

const CACHE_TTL_MS = 60 * 60 * 1000;

let factionMap: Map<number, EsiFaction> | null = null;
let cachedAt   = 0;
let cachedData: InsurgencySystem[] = [];

async function loadFactions(): Promise<Map<number, EsiFaction>> {
  if (factionMap) return factionMap;
  const res = await fetch('https://esi.evetech.net/latest/universe/factions/?datasource=tranquility');
  if (!res.ok) throw new Error(`ESI factions ${res.status}`);
  const list = await res.json() as EsiFaction[];
  factionMap = new Map(list.map((f) => [f.faction_id, f]));
  return factionMap;
}

async function fetchAndBuild(): Promise<InsurgencySystem[]> {
  const [warzoneRes, factions] = await Promise.all([
    fetch('https://www.eveonline.com/api/warzone/insurgency'),
    loadFactions(),
  ]);
  if (!warzoneRes.ok) throw new Error(`Warzone API ${warzoneRes.status}`);

  const campaigns = await warzoneRes.json() as Campaign[];
  const result: InsurgencySystem[] = [];

  for (const campaign of campaigns) {
    if (campaign.state !== 'ACTIVE') continue;
    const faction = factions.get(campaign.pirateFactionId);
    const factionName    = faction?.name ?? 'Unknown';
    const factionLogoUrl = faction?.corporation_id
      ? `https://images.evetech.net/corporations/${faction.corporation_id}/logo?size=64`
      : '';

    for (const ins of campaign.insurgencies) {
      result.push({
        systemId:         ins.solarSystem.id,
        campaignId:       campaign.campaignId,
        factionId:        campaign.pirateFactionId,
        factionName,
        factionLogoUrl,
        corruptionPct:    ins.corruptionPercentage,
        corruptionState:  ins.corruptionState,
        suppressionPct:   ins.suppressionPercentage,
        suppressionState: ins.suppressionState,
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
    console.error('Insurgency fetch failed:', err);
    if (cachedData.length) { res.json(cachedData); return; }
    res.status(502).json({ error: 'Failed to fetch insurgency data' });
  }
});

export default router;
