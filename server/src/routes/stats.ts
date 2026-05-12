import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

const SIG_TYPES = ['data', 'relic', 'gas', 'ore', 'combat', 'wormhole', 'unknown'] as const;
type SigType = typeof SIG_TYPES[number];

interface PeriodStats {
  jumps: number;
  signatures: { total: number } & Record<SigType, number>;
}

function emptyPeriod(): PeriodStats {
  return {
    jumps: 0,
    signatures: { total: 0, data: 0, relic: 0, gas: 0, ore: 0, combat: 0, wormhole: 0, unknown: 0 },
  };
}

router.get('/', async (req, res) => {
  const userId = req.session.userId!;

  const { rows } = await db.query<{ event_type: string; sig_type: string | null; created_at: Date }>(
    `SELECT event_type, sig_type, created_at
     FROM user_events
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  const now   = new Date();
  const start = {
    day:   new Date(now.getTime() - 24 * 60 * 60 * 1000),
    week:  new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000),
    month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    year:  new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
  };

  const result: Record<string, PeriodStats> = {
    forever: emptyPeriod(),
    year:    emptyPeriod(),
    month:   emptyPeriod(),
    week:    emptyPeriod(),
    day:     emptyPeriod(),
  };

  for (const row of rows) {
    const at = new Date(row.created_at);
    const periods = ['forever'];
    if (at >= start.year)  periods.push('year');
    if (at >= start.month) periods.push('month');
    if (at >= start.week)  periods.push('week');
    if (at >= start.day)   periods.push('day');

    for (const p of periods) {
      if (row.event_type === 'jump') {
        result[p].jumps++;
      } else if (row.event_type === 'signature') {
        result[p].signatures.total++;
        const t = (row.sig_type ?? 'unknown') as SigType;
        if (SIG_TYPES.includes(t)) result[p].signatures[t]++;
        else result[p].signatures.unknown++;
      }
    }
  }

  res.json(result);
});

export default router;
