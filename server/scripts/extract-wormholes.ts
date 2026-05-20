/**
 * Rebuild data/wormholes.json from the SDE we've already ingested.
 *
 * CCP encodes the deterministic wormhole stats as dogma attributes on the
 * "Wormhole XXX" item types. The fields we can pull straight from dogma:
 *   - destination class      (attr 1381, wormholeTargetSystemClass)
 *   - total mass             (attr 1382, massWormholeTotal)
 *   - max mass per jump      (attr 1383, massWormholeMaxJumpable)
 *   - mass regen             (attr 1384, massWormholeMassRegeneration)
 *   - lifetime               (attr 1503, wormholeMaxStableTime, seconds)
 *
 * What CCP does NOT encode in dogma is the *source* — "where does this WH
 * appear" is community/observation knowledge, not data. So we preserve the
 * `src`, `static`, and `sibling_groups` fields from the existing JSON for
 * every code we already know about, and print a list of brand-new codes at
 * the end so they can be reviewed manually.
 *
 * Run:
 *   yarn extract-wormholes
 *
 * Re-run after every SDE refresh to pull in new WH types.
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/db.js';

const ATTR = {
  destClass:   1381,
  totalMass:   1382,
  maxJumpable: 1383,
  massRegen:   1384,
  maxTime:     1503, // seconds
} as const;

// CCP's `wormholeTargetSystemClass` values → our string codes.
const CLASS_MAP: Record<number, string> = {
  1: 'c1', 2: 'c2', 3: 'c3', 4: 'c4', 5: 'c5', 6: 'c6',
  7: 'hs', 8: 'ls', 9: 'ns',
  12: 'thera', 13: 'c13',
  14: 'drifter', 15: 'drifter', 16: 'drifter', 17: 'drifter', 18: 'drifter',
  25: 'pochven',
};

interface WhRecord {
  mass_regen:        number;
  dest:              string;
  src:               string[];
  static:            boolean;
  max_mass_per_jump: number;
  lifetime:          number;       // hours
  total_mass:        number;
  sibling_groups:    number[] | null;
  typeID:            number;
}

async function main() {
  const path = join(process.cwd(), 'data', 'wormholes.json');
  const existing = JSON.parse(readFileSync(path, 'utf8')) as Record<string, WhRecord>;
  console.log(`Loaded existing JSON: ${Object.keys(existing).length} entries`);

  // Pull every wormhole type that has a destination-class dogma attribute.
  // Name match `Wormhole XXX` (3-char sig code) is the canonical signal;
  // K162 is included separately because its description encodes its quirks.
  const { rows } = await db.query<{
    type_id:      number;
    name:         string;
    dest_class:   string | null;
    total_mass:   string | null;
    max_jumpable: string | null;
    mass_regen:   string | null;
    max_time:     string | null;
  }>(`
    SELECT
      t.id AS type_id,
      t.name,
      MAX(CASE WHEN d.attribute_id = ${ATTR.destClass}   THEN d.value END) AS dest_class,
      MAX(CASE WHEN d.attribute_id = ${ATTR.totalMass}   THEN d.value END) AS total_mass,
      MAX(CASE WHEN d.attribute_id = ${ATTR.maxJumpable} THEN d.value END) AS max_jumpable,
      MAX(CASE WHEN d.attribute_id = ${ATTR.massRegen}   THEN d.value END) AS mass_regen,
      MAX(CASE WHEN d.attribute_id = ${ATTR.maxTime}     THEN d.value END) AS max_time
    FROM item_types t
    LEFT JOIN item_dogma_attributes d ON d.type_id = t.id
    WHERE t.name ~ '^Wormhole [A-Z][0-9]{3}$'
    GROUP BY t.id, t.name
    HAVING MAX(CASE WHEN d.attribute_id = ${ATTR.destClass} THEN d.value END) IS NOT NULL
    ORDER BY t.name
  `);

  const result:   Record<string, WhRecord> = {};
  const created:  string[] = [];
  const orphaned: string[] = [];
  const unknown:  string[] = [];
  const known     = new Set(Object.keys(existing));

  for (const row of rows) {
    const code = row.name.replace(/^Wormhole\s+/, '');
    const destNum = row.dest_class != null ? Math.round(parseFloat(row.dest_class)) : null;
    const dest = destNum != null ? CLASS_MAP[destNum] : null;
    if (!dest) {
      unknown.push(`${code} (dest_class=${row.dest_class})`);
      continue;
    }

    const prev = existing[code];
    if (!prev) created.push(code);

    result[code] = {
      mass_regen:        prev?.mass_regen        ?? Math.round(parseFloat(row.mass_regen   ?? '0')),
      dest,
      src:               prev?.src               ?? [],
      static:            prev?.static            ?? false,
      max_mass_per_jump: Math.round(parseFloat(row.max_jumpable ?? '0')),
      lifetime:          row.max_time != null
                           ? Math.round(parseFloat(row.max_time) / 3600)
                           : prev?.lifetime ?? 0,
      total_mass:        Math.round(parseFloat(row.total_mass ?? '0')),
      sibling_groups:    prev?.sibling_groups    ?? null,
      typeID:            row.type_id,
    };
  }

  // K162 isn't a real WH type from dogma's perspective — it's the "return"
  // side of every connection. Preserve whatever the existing JSON had.
  if (existing.K162 && !result.K162) result.K162 = existing.K162;

  for (const code of known) {
    if (!(code in result)) orphaned.push(code);
  }

  // 4-space indent matches the existing file's formatting.
  writeFileSync(path, JSON.stringify(result, null, 4) + '\n');

  console.log(`\nWrote ${Object.keys(result).length} wormhole types → ${path}`);
  if (created.length) {
    console.log(`\nNew codes since last run (need manual review of src / static / sibling_groups):`);
    for (const c of created) console.log(`  ${c}  →  ${result[c].dest.toUpperCase()}`);
  }
  if (orphaned.length) {
    console.log(`\nOrphaned codes — present in old JSON but not in current SDE:`);
    for (const c of orphaned) console.log(`  ${c}`);
  }
  if (unknown.length) {
    console.log(`\nWormhole types with an unmapped destination class:`);
    for (const u of unknown) console.log(`  ${u}`);
  }

  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
