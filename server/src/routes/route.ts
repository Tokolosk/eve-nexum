import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';
import { shortestRoutes, type RouteMode } from '../services/routeGraph.js';

const router = Router();
router.use(requireAuth);
const log = createLogger('route');

// BFS/Dijkstra are O(V+E) regardless of target count — extra targets
// just add early-termination checks. The cap exists purely to bound
// URL length (each ID is 8-9 chars) and prevent abuse. Proximity-alerts
// fans out across every hostile-sov system, which can run into the
// hundreds for users with wide negative-standing contact lists.
const MAX_TARGETS = 2000;
const VALID_MODES = new Set<RouteMode>(['shortest', 'secure']);

// Cache `alliance_id → corporation_id[]`. ESI updates rarely (corps
// don't shuffle hourly) — 1h matches the route-graph poll cadence.
const ALLIANCE_CORPS_TTL_MS = 60 * 60 * 1000;
const allianceCorpCache = new Map<number, { ids: number[]; at: number }>();

async function corpsInAlliance(allianceId: number): Promise<number[]> {
  const cached = allianceCorpCache.get(allianceId);
  if (cached && Date.now() - cached.at < ALLIANCE_CORPS_TTL_MS) return cached.ids;
  try {
    const r = await fetch(`https://esi.evetech.net/v2/alliances/${allianceId}/corporations/`);
    if (!r.ok) return cached?.ids ?? [];
    const ids = await r.json() as number[];
    allianceCorpCache.set(allianceId, { ids, at: Date.now() });
    return ids;
  } catch {
    return cached?.ids ?? [];
  }
}

// Build the set of corp IDs whose Ansiblexes this user can jump. Owned-by-
// own-corp is always included; alliance bridges are included when the user
// belongs to one (assumption: alliance-wide policies are the norm).
async function userBridgeCorps(userId: number): Promise<Set<number>> {
  const { rows } = await db.query<{ corp_id: number | null; alliance_id: number | null }>(
    `SELECT corp_id, alliance_id FROM users WHERE id = $1`,
    [userId],
  );
  const u = rows[0];
  const result = new Set<number>();
  if (u?.corp_id) result.add(u.corp_id);
  if (u?.alliance_id) {
    const corps = await corpsInAlliance(u.alliance_id);
    for (const c of corps) result.add(c);
  }
  return result;
}

// GET /api/route/bridges — diagnostic. Returns:
//   total:     how many ansiblex rows we have (any owner)
//   resolved:  bridges whose target system name we parsed and matched
//   accessible: bridges this caller's corp + alliance own
// Useful when "Include Jump Bridges" doesn't change a route — tells you
// whether the issue is empty index, parse failure, or ownership filter.
router.get('/bridges', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'not authed' });
  const allowed = await userBridgeCorps(req.session.userId);
  const [totalQ, resolvedQ, accessibleQ] = await Promise.all([
    db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ansiblex_bridges`),
    db.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ansiblex_bridges WHERE to_system_id IS NOT NULL`),
    allowed.size === 0
      ? Promise.resolve({ rows: [] })
      : db.query<{ name: string; owner_corp_id: number; from_system_id: number; to_system_id: number | null }>(
          `SELECT name, owner_corp_id, from_system_id, to_system_id
             FROM ansiblex_bridges
            WHERE owner_corp_id = ANY($1::int[])
            ORDER BY name`,
          [Array.from(allowed)],
        ),
  ]);
  res.json({
    total:               Number(totalQ.rows[0]?.n ?? 0),
    resolved:            Number(resolvedQ.rows[0]?.n ?? 0),
    yourAllowedCorps:    [...allowed],
    accessibleBridges:   accessibleQ.rows,
  });
});

// GET /api/route?from=<systemId>&to=<id1>,<id2>,...&mode=shortest|secure&includeBridges=true|false
// Returns { [targetId]: { jumps, path } } for each reachable target.
router.get('/', async (req, res) => {
  const from = Number(req.query.from);
  if (!Number.isInteger(from) || from <= 0) {
    return res.status(400).json({ error: 'Invalid "from"' });
  }

  const toRaw = String(req.query.to ?? '').trim();
  if (!toRaw) return res.json({});

  const targets = toRaw.split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0);

  if (targets.length === 0) return res.json({});
  if (targets.length > MAX_TARGETS) {
    return res.status(400).json({ error: `Too many targets (max ${MAX_TARGETS})` });
  }

  const modeRaw = String(req.query.mode ?? 'shortest') as RouteMode;
  const mode: RouteMode = VALID_MODES.has(modeRaw) ? modeRaw : 'shortest';
  const includeBridges = String(req.query.includeBridges ?? 'false') === 'true';

  try {
    const allowedCorps = includeBridges && req.session.userId
      ? await userBridgeCorps(req.session.userId)
      : new Set<number>();
    const result = await shortestRoutes(from, targets, mode, allowedCorps);
    return res.json(result);
  } catch (err) {
    log.error('Route compute failed:', err);
    return res.status(500).json({ error: 'Route computation failed' });
  }
});

export default router;
