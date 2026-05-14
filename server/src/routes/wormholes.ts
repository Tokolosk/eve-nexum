import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLogger } from '../utils/logger.js';

const router = Router();
router.use(requireAuth);
const log = createLogger('wormholes');

interface RawSpec {
  total_mass:        number;
  max_mass_per_jump: number;
  mass_regen?:       number;
  lifetime:          number;
  dest:              string;
  src?:              string[];
  static?:           boolean;
  typeID?:           number;
}

export interface WormholeSpec {
  totalMass:      number; // kg
  maxJumpMass:    number; // kg
  massRegen:      number; // kg/hour
  lifetimeHours:  number;
  dest:           string;
  src:            string[];
}

let cache: Record<string, WormholeSpec> | null = null;
try {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'wormholes.json'), 'utf8'),
  ) as Record<string, RawSpec>;
  cache = {};
  for (const [code, spec] of Object.entries(raw)) {
    cache[code] = {
      totalMass:     spec.total_mass,
      maxJumpMass:   spec.max_mass_per_jump,
      massRegen:     spec.mass_regen ?? 0,
      lifetimeHours: spec.lifetime,
      dest:          spec.dest,
      src:           spec.src ?? [],
    };
  }
  log.info(`Loaded ${Object.keys(cache).length} wormhole type specs`);
} catch (err) {
  log.error('Failed to load wormholes.json:', err);
}

router.get('/types', (_req, res) => {
  res.json(cache ?? {});
});

export default router;
