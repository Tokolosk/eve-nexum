import { db } from '../db.js';
import { createLogger } from '../utils/logger.js';
import { invalidateBridgeGraph } from './routeGraph.js';

const log = createLogger('ansiblex');

// Ansiblex Jump Gate
const ANSIBLEX_TYPE_ID = 35841;

// Community convention: Ansiblex names embed the endpoint pair as
// "Source » Destination", with one structure on each side of the bridge.
// We tolerate optional whitespace around the separator and fall back to
// `>>` / `>` for owners that use ASCII. Returns null when the name
// doesn't look like a bridge label.
function parseBridgeName(name: string): { source: string; target: string } | null {
  const m = name.match(/^\s*(.+?)\s*(?:»|>>|>)\s*(.+?)\s*$/);
  if (!m) return null;
  return { source: m[1], target: m[2] };
}

/**
 * Re-derive ansiblex_bridges from the structures we've cached. Called
 * after every successful corp-structures refresh; idempotent and cheap
 * (single SELECT + bulk UPSERT). Invalidates the in-memory bridge graph
 * so the router picks up the new state on its next compute.
 */
export async function refreshBridgeIndex(): Promise<void> {
  const { rows: bridges } = await db.query<{
    structure_id:  string;
    system_id:     number;
    owner_corp_id: number;
    name:          string;
  }>(
    `SELECT structure_id, system_id, owner_corp_id, name
       FROM known_structures
      WHERE type_id = $1`,
    [ANSIBLEX_TYPE_ID],
  );
  if (bridges.length === 0) return;

  // Resolve target system names to IDs in one shot — most Ansiblexes
  // share a small pool of hub destinations.
  const targetNames = new Set<string>();
  const parsed = new Map<string, { source: string; target: string } | null>();
  for (const b of bridges) {
    const p = parseBridgeName(b.name);
    parsed.set(b.structure_id, p);
    if (p) targetNames.add(p.target);
  }

  const nameToId = new Map<string, number>();
  if (targetNames.size > 0) {
    const { rows: sys } = await db.query<{ id: number; name: string }>(
      `SELECT id, name FROM solar_systems WHERE name = ANY($1::text[])`,
      [Array.from(targetNames)],
    );
    for (const s of sys) nameToId.set(s.name, s.id);
  }

  const rows = bridges.map((b) => {
    const p = parsed.get(b.structure_id);
    return {
      structure_id:   b.structure_id,
      from_system_id: b.system_id,
      to_system_id:   p ? (nameToId.get(p.target) ?? null) : null,
      to_system_name: p?.target ?? null,
      owner_corp_id:  b.owner_corp_id,
      name:           b.name,
    };
  });

  const ids   = rows.map((r) => r.structure_id);
  const from  = rows.map((r) => r.from_system_id);
  const to    = rows.map((r) => r.to_system_id);
  const tName = rows.map((r) => r.to_system_name);
  const owner = rows.map((r) => r.owner_corp_id);
  const names = rows.map((r) => r.name);

  await db.query(
    `INSERT INTO ansiblex_bridges
       (structure_id, from_system_id, to_system_id, to_system_name, owner_corp_id, name, updated_at)
     SELECT t.id::bigint, t.f, t.t, t.tn, t.o, t.n, NOW()
       FROM UNNEST($1::bigint[], $2::int[], $3::int[], $4::text[], $5::int[], $6::text[])
         AS t(id, f, t, tn, o, n)
     ON CONFLICT (structure_id) DO UPDATE SET
       from_system_id  = EXCLUDED.from_system_id,
       to_system_id    = EXCLUDED.to_system_id,
       to_system_name  = EXCLUDED.to_system_name,
       owner_corp_id   = EXCLUDED.owner_corp_id,
       name            = EXCLUDED.name,
       updated_at      = NOW()`,
    [ids, from, to, tName, owner, names],
  );

  const resolved   = rows.filter((r) => r.to_system_id !== null).length;
  const unresolved = rows.length - resolved;
  log.info(`indexed ${rows.length} ansiblex(es) (${resolved} resolved, ${unresolved} with unparseable / unknown targets)`);

  // Tell the route graph to drop its memoised view; next route compute
  // will pull the fresh rows.
  invalidateBridgeGraph();
}
