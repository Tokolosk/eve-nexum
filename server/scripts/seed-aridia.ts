/**
 * Creates an "Aridia" map populated with all systems and stargate connections
 * for the Aridia region (region_id 10000050).
 *
 * Positions are derived from the systems' real EVE 3D coordinates fetched from
 * the ESI and projected onto a 2D canvas to match the dotlan layout.
 *
 * Run:  cd server && npx tsx scripts/seed-aridia.ts
 */

import 'dotenv/config';
import { db } from '../src/db.js';

const ESI        = 'https://esi.evetech.net/latest';
const ARIDIA_ID  = 10000050;
const CANVAS_W   = 3200;
const CANVAS_H   = 2000;
const NODE_W     = 160;
const NODE_H     = 80;
const PAD        = 80;

// ── 1. Fetch all Aridia systems from local SDE ────────────────────────────────

async function getAriidaSystems() {
  const { rows } = await db.query<{
    id: number; name: string; security: number; class: string;
  }>(
    `SELECT id, name, security, class FROM solar_systems WHERE region_id = $1 ORDER BY id`,
    [ARIDIA_ID],
  );
  return rows;
}

// ── 2. Fetch stargate connections that are internal to Aridia ─────────────────

async function getInternalConnections(systemIds: Set<number>) {
  const ids = [...systemIds];
  const { rows } = await db.query<{ system_id: number; destination_system_id: number }>(
    `SELECT system_id, destination_system_id
     FROM map_stargates
     WHERE system_id = ANY($1) AND destination_system_id = ANY($1)`,
    [ids],
  );
  // Deduplicate: only keep each pair once (lower id first)
  const seen = new Set<string>();
  const unique: Array<{ a: number; b: number }> = [];
  for (const row of rows) {
    const key = [Math.min(row.system_id, row.destination_system_id),
                 Math.max(row.system_id, row.destination_system_id)].join('-');
    if (!seen.has(key)) { seen.add(key); unique.push({ a: row.system_id, b: row.destination_system_id }); }
  }
  return unique;
}

// ── 3. Fetch 3D coordinates from ESI ─────────────────────────────────────────

interface EsiSystem { position: { x: number; y: number; z: number } }

const coordCache = new Map<number, { x: number; y: number; z: number }>();

async function fetchCoords(id: number) {
  if (coordCache.has(id)) return coordCache.get(id)!;
  const r = await fetch(`${ESI}/universe/systems/${id}/?datasource=tranquility`);
  if (!r.ok) return null;
  const d = await r.json() as EsiSystem;
  const coords = d.position;
  coordCache.set(id, coords);
  return coords;
}

// ── 4. Project EVE 3D coords → 2D canvas ─────────────────────────────────────
// EVE uses Y as "up"; the dotlan map projects onto the XZ plane.

function project(
  systems: Array<{ id: number; pos: { x: number; z: number } | null }>,
): Map<number, { x: number; y: number }> {
  const valid = systems.filter((s) => s.pos !== null) as Array<{ id: number; pos: { x: number; z: number } }>;

  const xs = valid.map((s) => s.pos.x);
  const zs = valid.map((s) => s.pos.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);

  const result = new Map<number, { x: number; y: number }>();
  for (const s of valid) {
    const nx = (s.pos.x - minX) / (maxX - minX);   // 0–1
    const nz = (s.pos.z - minZ) / (maxZ - minZ);   // 0–1
    result.set(s.id, {
      x: Math.round(PAD + nx * (CANVAS_W - NODE_W - PAD * 2)),
      y: Math.round(PAD + nz * (CANVAS_H - NODE_H - PAD * 2)),
    });
  }
  return result;
}

// ── 5. Map EVE security → SystemClass ────────────────────────────────────────

function secClass(cls: string, security: number): string {
  if (cls && cls !== '') return cls;          // wormhole class already set
  if (security >= 0.5)   return 'HS';
  if (security > 0.0)    return 'LS';
  return 'NS';
}

// ── 6. Write to DB ────────────────────────────────────────────────────────────

async function run() {
  console.log('Fetching Aridia systems from local SDE…');
  const systems = await getAriidaSystems();
  console.log(`  Found ${systems.length} systems`);

  const systemIds = new Set(systems.map((s) => s.id));

  console.log('Fetching stargate connections…');
  const connections = await getInternalConnections(systemIds);
  console.log(`  Found ${connections.length} internal connections`);

  console.log('Fetching EVE coordinates from ESI (this may take a moment)…');
  const withPos = await Promise.all(
    systems.map(async (s) => {
      const coords = await fetchCoords(s.id);
      return { id: s.id, pos: coords ? { x: coords.x, z: coords.z } : null };
    }),
  );
  const posMap = project(withPos);
  console.log(`  Projected ${posMap.size} system positions`);

  // Create map
  // Use the first user in the DB (the map owner)
  const userRes = await db.query<{ id: string }>(`SELECT id FROM users LIMIT 1`);
  if (!userRes.rows.length) throw new Error('No users found — log in to the app first, then re-run this script.');
  const userId = userRes.rows[0].id;

  const mapRes = await db.query<{ id: string }>(
    `INSERT INTO maps (id, user_id, name, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'Aridia', NOW(), NOW())
     RETURNING id`,
    [userId],
  );
  const mapId = mapRes.rows[0].id;
  console.log(`Created map "${mapId}"`);

  // Insert systems
  const sysIdMap = new Map<number, string>(); // eveId → uuid
  for (const sys of systems) {
    const pos = posMap.get(sys.id) ?? { x: 0, y: 0 };
    const res = await db.query<{ id: string }>(
      `INSERT INTO map_systems
         (id, map_id, eve_system_id, name, system_class, effect, statics,
          region_name, position_x, position_y, status)
       VALUES
         (gen_random_uuid(), $1, $2, $3, $4, 'none', '{}', 'Aridia', $5, $6, 'unknown')
       RETURNING id`,
      [mapId, sys.id, sys.name, secClass(sys.class, sys.security), pos.x, pos.y],
    );
    sysIdMap.set(sys.id, res.rows[0].id);
  }
  console.log(`Inserted ${sysIdMap.size} systems`);

  // Insert connections
  let connCount = 0;
  for (const { a, b } of connections) {
    const srcUuid = sysIdMap.get(a);
    const tgtUuid = sysIdMap.get(b);
    if (!srcUuid || !tgtUuid) continue;
    await db.query(
      `INSERT INTO map_connections
         (id, map_id, source_id, target_id, connection_type, size)
       VALUES
         (gen_random_uuid(), $1, $2, $3, 'standard', 'large')`,
      [mapId, srcUuid, tgtUuid],
    );
    connCount++;
  }
  console.log(`Inserted ${connCount} connections`);

  await db.end();
  console.log('Done! Refresh the app and switch to the "Aridia" map.');
}

run().catch((err) => { console.error(err); process.exit(1); });
