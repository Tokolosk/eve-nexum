import type { SystemKills } from '../hooks/useCurrentHourKills';
import type { FleetState } from '../hooks/useFleet';

// One heatmap can be active at a time. 'none' = off.
export type HeatMetric = 'none' | 'fleet' | 'shipKills' | 'podKills' | 'npcKills' | 'jumps';

export const HEAT_METRICS: HeatMetric[] = ['none', 'fleet', 'shipKills', 'podKills', 'npcKills', 'jumps'];

// Standard heat ramp: low = yellow, mid = orange, high = red. The colour
// encodes intensity (not the metric), so every heatmap reads the same way.
// `level` is the normalised 0..1 value for the system.
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const HEAT_STOPS: [number, number, number][] = [
  [250, 204, 21],  // #facc15 yellow
  [249, 115, 22],  // #f97316 orange
  [220, 38,  38],  // #dc2626 red
];
export function heatColor(level: number): string {
  const l = Math.min(1, Math.max(0, level));
  const seg = l <= 0.5 ? 0 : 1;
  const t   = l <= 0.5 ? l / 0.5 : (l - 0.5) / 0.5;
  const [r1, g1, b1] = HEAT_STOPS[seg];
  const [r2, g2, b2] = HEAT_STOPS[seg + 1];
  return `rgb(${lerp(r1, r2, t)}, ${lerp(g1, g2, t)}, ${lerp(b1, b2, t)})`;
}

/**
 * Raw value of a metric for one system (0 when unknown / off). Fleet counts
 * members in the system minus the signed-in pilot; the rest read the hourly
 * ESI activity snapshot. Used both per-node and to find the per-map max for
 * normalisation, so the two always agree.
 */
export function heatValue(
  metric: HeatMetric,
  eveSystemId: number | null,
  kills: Map<number, SystemKills>,
  fleet: FleetState,
  selfCharId: number | null | undefined,
): number {
  if (metric === 'none' || eveSystemId == null) return 0;
  if (metric === 'fleet') {
    const all = fleet.bySystem.get(eveSystemId);
    if (!all) return 0;
    return selfCharId ? all.filter((m) => m.characterId !== selfCharId).length : all.length;
  }
  const k = kills.get(eveSystemId);
  if (!k) return 0;
  switch (metric) {
    case 'shipKills': return k.shipKills;
    case 'podKills':  return k.podKills;
    case 'npcKills':  return k.npcKills;
    case 'jumps':     return k.jumps;
    default:          return 0;
  }
}
