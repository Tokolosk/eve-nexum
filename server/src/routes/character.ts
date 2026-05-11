import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getValidToken } from '../utils/eveToken.js';

export const characterRouter = Router();
characterRouter.use(requireAuth);

// GET /api/character/location
// Returns the character's current system if online, or { online: false }
characterRouter.get('/location', async (req, res) => {
  try {
    const { rows: userRows } = await db.query<{ character_id: number }>(
      `SELECT character_id FROM users WHERE id = $1`,
      [req.session.userId],
    );
    if (!userRows.length) { res.status(404).json({ error: 'User not found' }); return; }

    const token       = await getValidToken(req.session.userId!);
    const characterId = userRows[0].character_id;

    // Check online status first
    const onlineRes = await fetch(
      `https://esi.evetech.net/latest/characters/${characterId}/online/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!onlineRes.ok || onlineRes.status === 401 || onlineRes.status === 403) {
      res.json({ online: false }); return;
    }
    const { online } = await onlineRes.json() as { online: boolean };
    if (!online) { res.json({ online: false }); return; }

    // Fetch current location
    const locRes = await fetch(
      `https://esi.evetech.net/latest/characters/${characterId}/location/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!locRes.ok) { res.json({ online: true, system: null }); return; }

    const loc = await locRes.json() as { solar_system_id: number };

    // Look up system details in our DB
    const { rows } = await db.query(
      `SELECT s.id AS "eveSystemId", s.name, s.class AS "systemClass",
              COALESCE(s.effect, 'none') AS effect, s.statics,
              r.name AS "regionName", r.npc_type AS "npcType"
       FROM solar_systems s
       LEFT JOIN map_regions r ON r.id = s.region_id
       WHERE s.id = $1`,
      [loc.solar_system_id],
    );

    if (!rows.length) { res.json({ online: true, system: null }); return; }
    res.json({ online: true, system: rows[0] });
  } catch (err) {
    console.error('Location check failed:', err);
    res.status(500).json({ error: 'Failed to get location' });
  }
});

// POST /api/character/waypoint
characterRouter.post('/waypoint', async (req, res) => {
  const { destinationId, addToBeginning = false, clearOtherWaypoints = false } =
    req.body as { destinationId: number; addToBeginning?: boolean; clearOtherWaypoints?: boolean };

  if (!destinationId) { res.status(400).json({ error: 'destinationId required' }); return; }

  const { rows } = await db.query<{ character_id: number }>(
    `SELECT character_id FROM users WHERE id = $1`,
    [req.session.userId],
  );
  if (!rows.length) { res.status(404).json({ error: 'User not found' }); return; }

  try {
    const token  = await getValidToken(req.session.userId!);
    const params = new URLSearchParams({
      add_to_beginning:     String(addToBeginning),
      clear_other_waypoints: String(clearOtherWaypoints),
      destination_id:       String(destinationId),
    });
    const esiRes = await fetch(
      `https://esi.evetech.net/latest/ui/autopilot/waypoint/?${params}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    if (!esiRes.ok) { res.status(502).json({ error: `ESI returned ${esiRes.status}` }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error('Waypoint set failed:', err);
    res.status(500).json({ error: 'Failed to set waypoint' });
  }
});

// GET /api/character/online
characterRouter.get('/online', async (req, res) => {
  try {
    const { rows } = await db.query<{ character_id: number }>(
      `SELECT character_id FROM users WHERE id = $1`,
      [req.session.userId],
    );
    if (!rows.length) { res.status(404).json({ error: 'User not found' }); return; }

    const token = await getValidToken(req.session.userId!);
    const characterId = rows[0].character_id;

    const esiRes = await fetch(
      `https://esi.evetech.net/latest/characters/${characterId}/online/`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // 401 = token invalid/no scopes, 403 = token valid but scope missing
    if (esiRes.status === 401 || esiRes.status === 403) {
      res.json({ online: null, scopeMissing: true });
      return;
    }

    if (!esiRes.ok) {
      const body = await esiRes.text();
      console.error(`ESI online check: ${esiRes.status}`, body);
      res.status(502).json({ error: `ESI returned ${esiRes.status}` });
      return;
    }

    const data = await esiRes.json() as { online: boolean; last_login?: string; last_logout?: string };
    res.json({ online: data.online });
  } catch (err) {
    console.error('Online check failed:', err);
    res.status(500).json({ error: 'Failed to check online status' });
  }
});
