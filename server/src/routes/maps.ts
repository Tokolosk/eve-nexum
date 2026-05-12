import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const mapsRouter = Router();
mapsRouter.use(requireAuth);

// ── Maps ──────────────────────────────────────────────────────────────────────

const MAX_MAPS = parseInt(process.env.MAX_USER_MAPS ?? '10', 10);

// GET /api/maps
mapsRouter.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM maps WHERE user_id = $1 ORDER BY created_at`,
    [req.session.userId],
  );
  res.json({ maps: rows, maxMaps: MAX_MAPS });
});

// POST /api/maps
mapsRouter.post('/', async (req, res) => {
  const { rowCount } = await db.query(
    `SELECT 1 FROM maps WHERE user_id = $1`,
    [req.session.userId],
  );
  if ((rowCount ?? 0) >= MAX_MAPS) {
    res.status(403).json({ error: 'Maximum maps reached' });
    return;
  }
  const name = String(req.body.name ?? 'New Map');
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO maps (user_id, name) VALUES ($1, $2) RETURNING id`,
    [req.session.userId, name],
  );
  res.status(201).json({ id: rows[0].id });
});

// POST /api/maps/import
mapsRouter.post('/import', async (req, res) => {
  const { rowCount } = await db.query(
    `SELECT 1 FROM maps WHERE user_id = $1`,
    [req.session.userId],
  );
  if ((rowCount ?? 0) >= MAX_MAPS) {
    res.status(403).json({ error: 'Maximum maps reached' });
    return;
  }

  const { name, systems = [], connections = [] } = req.body as {
    name?: string;
    systems?: Array<Record<string, unknown>>;
    connections?: Array<Record<string, unknown>>;
  };

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const mapRes = await client.query<{ id: string }>(
      `INSERT INTO maps (user_id, name) VALUES ($1, $2) RETURNING id`,
      [req.session.userId, String(name ?? 'Imported Map')],
    );
    const mapId = mapRes.rows[0].id;

    // Remap old system UUIDs → fresh ones to avoid any collisions on re-import
    const idMap = new Map<string, string>();
    for (const sys of systems) {
      const newId = crypto.randomUUID();
      idMap.set(String(sys.id), newId);
      const pos = (sys.position as { x: number; y: number }) ?? { x: 0, y: 0 };
      await client.query(
        `INSERT INTO map_systems
           (id, map_id, eve_system_id, name, system_class, effect, statics, region_name, npc_type,
            position_x, position_y, status, is_home, locked, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [newId, mapId, sys.eveSystemId ?? null, sys.name, sys.systemClass,
         sys.effect ?? 'none', sys.statics ?? [], sys.regionName ?? null, sys.npcType ?? null,
         pos.x, pos.y, sys.status ?? 'unknown', sys.isHome ?? false, sys.locked ?? false, sys.notes ?? ''],
      );
    }

    for (const conn of connections) {
      const srcId = idMap.get(String(conn.sourceId));
      const tgtId = idMap.get(String(conn.targetId));
      if (!srcId || !tgtId) continue;
      await client.query(
        `INSERT INTO map_connections
           (id, map_id, source_id, target_id, source_handle, target_handle,
            connection_type, mass_status, time_status, size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [crypto.randomUUID(), mapId, srcId, tgtId,
         conn.sourceHandle ?? null, conn.targetHandle ?? null,
         conn.connectionType ?? 'standard', conn.massStatus ?? null,
         conn.timeStatus ?? null, conn.size ?? 'large'],
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ id: mapId });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// GET /api/maps/:mapId  — full map (systems + connections)
mapsRouter.get('/:mapId', async (req, res) => {
  const { mapId } = req.params;

  const mapRows = await db.query(
    `SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM maps WHERE id = $1 AND user_id = $2`,
    [mapId, req.session.userId],
  );
  if (!mapRows.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }

  const systems = await db.query(
    `SELECT id, eve_system_id AS "eveSystemId", name, system_class AS "systemClass",
            effect, statics, region_name AS "regionName", npc_type AS "npcType",
            position_x AS x, position_y AS y,
            status, is_home AS "isHome", locked, notes
     FROM map_systems WHERE map_id = $1`,
    [mapId],
  );

  const connections = await db.query(
    `SELECT id, source_id AS "sourceId", target_id AS "targetId",
            source_handle AS "sourceHandle", target_handle AS "targetHandle",
            connection_type AS "connectionType", mass_status AS "massStatus",
            time_status AS "timeStatus", size, created_at AS "createdAt"
     FROM map_connections WHERE map_id = $1`,
    [mapId],
  );

  res.json({
    ...mapRows.rows[0],
    systems: systems.rows.map((s) => ({ ...s, position: { x: s.x, y: s.y } })),
    connections: connections.rows,
  });
});

// PATCH /api/maps/:mapId
mapsRouter.patch('/:mapId', async (req, res) => {
  const { mapId } = req.params;
  const { name } = req.body as { name?: string };
  if (!name) { res.status(400).json({ error: 'name required' }); return; }

  const { rowCount } = await db.query(
    `UPDATE maps SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
    [name, mapId, req.session.userId],
  );
  if (!rowCount) { res.status(404).json({ error: 'Map not found' }); return; }
  res.json({ ok: true });
});

// DELETE /api/maps/:mapId
mapsRouter.delete('/:mapId', async (req, res) => {
  await db.query(`DELETE FROM maps WHERE id = $1 AND user_id = $2`, [req.params.mapId, req.session.userId]);
  res.json({ ok: true });
});

// ── Systems ───────────────────────────────────────────────────────────────────

mapsRouter.post('/:mapId/systems', async (req, res) => {
  const { mapId } = req.params;
  const { id, eveSystemId, name, systemClass, effect, statics, regionName, npcType, position, status, isHome, locked, notes } = req.body;

  await db.query(
    `INSERT INTO map_systems
       (id, map_id, eve_system_id, name, system_class, effect, statics, region_name, npc_type,
        position_x, position_y, status, is_home, locked, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO NOTHING`,
    [id, mapId, eveSystemId ?? null, name, systemClass, effect ?? 'none',
     statics ?? [], regionName ?? null, npcType ?? null,
     position?.x ?? 0, position?.y ?? 0,
     status ?? 'unknown', isHome ?? false, locked ?? false, notes ?? ''],
  );
  await touchMap(mapId);
  res.status(201).json({ ok: true });
});

mapsRouter.patch('/:mapId/systems/:systemId', async (req, res) => {
  const { mapId, systemId } = req.params;
  const updates = req.body as Record<string, unknown>;

  const allowed = ['name','system_class','effect','statics','region_name','npc_type',
                   'position_x','position_y','status','is_home','locked','notes'];

  // map camelCase → snake_case for the DB columns we accept
  const colMap: Record<string, string> = {
    name: 'name', systemClass: 'system_class', effect: 'effect', statics: 'statics',
    regionName: 'region_name', npcType: 'npc_type',
    status: 'status', isHome: 'is_home', locked: 'locked', notes: 'notes',
  };

  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) {
      sets.push(`${col} = $${vals.length + 1}`);
      vals.push(updates[key]);
    }
  }

  // handle position separately
  if (updates.position && typeof updates.position === 'object') {
    const pos = updates.position as { x?: number; y?: number };
    if (pos.x !== undefined) { sets.push(`position_x = $${vals.length + 1}`); vals.push(pos.x); }
    if (pos.y !== undefined) { sets.push(`position_y = $${vals.length + 1}`); vals.push(pos.y); }
  }

  if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }

  // verify map ownership
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }

  await db.query(
    `UPDATE map_systems SET ${sets.join(', ')} WHERE id = $${vals.length + 1} AND map_id = $${vals.length + 2}`,
    [...vals, systemId, mapId],
  );
  await touchMap(mapId);
  res.json({ ok: true });
});

mapsRouter.delete('/:mapId/systems/:systemId', async (req, res) => {
  const { mapId, systemId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  await db.query(`DELETE FROM map_systems WHERE id = $1 AND map_id = $2`, [systemId, mapId]);
  await touchMap(mapId);
  res.json({ ok: true });
});

// ── Connections ───────────────────────────────────────────────────────────────

mapsRouter.post('/:mapId/connections', async (req, res) => {
  const { mapId } = req.params;
  const { id, sourceId, targetId, sourceHandle, targetHandle, connectionType, massStatus, timeStatus, size } = req.body;

  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }

  await db.query(
    `INSERT INTO map_connections
       (id, map_id, source_id, target_id, source_handle, target_handle,
        connection_type, mass_status, time_status, size)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (id) DO NOTHING`,
    [id, mapId, sourceId, targetId, sourceHandle ?? null, targetHandle ?? null,
     connectionType ?? 'standard', massStatus ?? null, timeStatus ?? null, size ?? 'large'],
  );
  await touchMap(mapId);
  res.status(201).json({ ok: true });
});

mapsRouter.patch('/:mapId/connections/:connectionId', async (req, res) => {
  const { mapId, connectionId } = req.params;

  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }

  const colMap: Record<string, string> = {
    connectionType: 'connection_type', massStatus: 'mass_status',
    timeStatus: 'time_status', size: 'size',
    sourceHandle: 'source_handle', targetHandle: 'target_handle',
  };

  const updates = req.body as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) {
      sets.push(`${col} = $${vals.length + 1}`);
      vals.push(updates[key]);
    }
  }

  if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }

  await db.query(
    `UPDATE map_connections SET ${sets.join(', ')} WHERE id = $${vals.length + 1} AND map_id = $${vals.length + 2}`,
    [...vals, connectionId, mapId],
  );
  await touchMap(mapId);
  res.json({ ok: true });
});

mapsRouter.delete('/:mapId/connections/:connectionId', async (req, res) => {
  const { mapId, connectionId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  await db.query(`DELETE FROM map_connections WHERE id = $1 AND map_id = $2`, [connectionId, mapId]);
  await touchMap(mapId);
  res.json({ ok: true });
});

// ── Signatures ────────────────────────────────────────────────────────────────

mapsRouter.get('/:mapId/systems/:systemId/signatures', async (req, res) => {
  const { mapId, systemId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  const { rows } = await db.query(
    `SELECT id, sig_id AS "sigId", sig_type AS "sigType", name, notes, wh_type AS "whType", wh_leads_to AS "whLeadsTo", created_at AS "createdAt"
     FROM map_signatures WHERE system_id = $1 ORDER BY created_at`,
    [systemId],
  );
  res.json(rows);
});

mapsRouter.post('/:mapId/systems/:systemId/signatures', async (req, res) => {
  const { mapId, systemId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  const { sigId = '', sigType = 'unknown', name = '', notes = '', whType = '', whLeadsTo = '' } = req.body as Record<string, string>;
  const { rows } = await db.query(
    `INSERT INTO map_signatures (system_id, sig_id, sig_type, name, notes, wh_type, wh_leads_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, sig_id AS "sigId", sig_type AS "sigType", name, notes, wh_type AS "whType", wh_leads_to AS "whLeadsTo", created_at AS "createdAt"`,
    [systemId, sigId, sigType, name, notes, whType, whLeadsTo],
  );
  db.query(
    `INSERT INTO user_events (user_id, event_type, sig_type) VALUES ($1, 'signature', $2)`,
    [req.session.userId, sigType],
  ).catch(console.error);
  res.status(201).json(rows[0]);
});

mapsRouter.patch('/:mapId/systems/:systemId/signatures/:sigId', async (req, res) => {
  const { mapId, systemId, sigId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }

  const colMap: Record<string, string> = { sigId: 'sig_id', sigType: 'sig_type', name: 'name', notes: 'notes', whType: 'wh_type', whLeadsTo: 'wh_leads_to' };
  const updates = req.body as Record<string, unknown>;
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) { sets.push(`${col} = $${vals.length + 1}`); vals.push(updates[key]); }
  }

  await db.query(
    `UPDATE map_signatures SET ${sets.join(', ')} WHERE id = $${vals.length + 1} AND system_id = $${vals.length + 2}`,
    [...vals, sigId, systemId],
  );
  res.json({ ok: true });
});

mapsRouter.delete('/:mapId/systems/:systemId/signatures/:sigId', async (req, res) => {
  const { mapId, systemId, sigId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  await db.query(`DELETE FROM map_signatures WHERE id = $1 AND system_id = $2`, [sigId, systemId]);
  res.json({ ok: true });
});

// ── Structures (manual player structures) ─────────────────────────────────────

mapsRouter.get('/:mapId/systems/:systemId/structures', async (req, res) => {
  const { mapId, systemId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  const { rows } = await db.query(
    `SELECT id, name, structure_type AS "structureType", owner_corp AS "ownerCorp", eve_id AS "eveId", notes, created_at AS "createdAt"
     FROM map_structures WHERE system_id = $1 ORDER BY created_at`,
    [systemId],
  );
  res.json(rows);
});

mapsRouter.post('/:mapId/systems/:systemId/structures', async (req, res) => {
  const { mapId, systemId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  const { name = '', structureType = 'unknown', ownerCorp = '', notes = '', eveId = null } = req.body as Record<string, string>;
  const { rows } = await db.query(
    `INSERT INTO map_structures (system_id, name, structure_type, owner_corp, eve_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, structure_type AS "structureType", owner_corp AS "ownerCorp", eve_id AS "eveId", notes, created_at AS "createdAt"`,
    [systemId, name, structureType, ownerCorp, eveId || null, notes],
  );
  res.status(201).json(rows[0]);
});

mapsRouter.patch('/:mapId/systems/:systemId/structures/:structureId', async (req, res) => {
  const { mapId, systemId, structureId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }

  const colMap: Record<string, string> = { name: 'name', structureType: 'structure_type', ownerCorp: 'owner_corp', eveId: 'eve_id', notes: 'notes' };
  const updates = req.body as Record<string, unknown>;
  const sets: string[] = ['updated_at = NOW()'];
  const vals: unknown[] = [];

  for (const [key, col] of Object.entries(colMap)) {
    if (key in updates) { sets.push(`${col} = $${vals.length + 1}`); vals.push(updates[key]); }
  }

  await db.query(
    `UPDATE map_structures SET ${sets.join(', ')} WHERE id = $${vals.length + 1} AND system_id = $${vals.length + 2}`,
    [...vals, structureId, systemId],
  );
  res.json({ ok: true });
});

mapsRouter.delete('/:mapId/systems/:systemId/structures/:structureId', async (req, res) => {
  const { mapId, systemId, structureId } = req.params;
  const own = await db.query(`SELECT 1 FROM maps WHERE id = $1 AND user_id = $2`, [mapId, req.session.userId]);
  if (!own.rows.length) { res.status(404).json({ error: 'Map not found' }); return; }
  await db.query(`DELETE FROM map_structures WHERE id = $1 AND system_id = $2`, [structureId, systemId]);
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function touchMap(mapId: string) {
  await db.query(`UPDATE maps SET updated_at = NOW() WHERE id = $1`, [mapId]);
}
