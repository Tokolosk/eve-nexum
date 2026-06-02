import type { SystemKills } from '../hooks/useCurrentHourKills';
import type { FleetState } from '../hooks/useFleet';

// One heatmap can be active at a time. 'none' = off.
export type HeatMetric = 'none' | 'fleet' | 'shipKills' | 'podKills' | 'npcKills' | 'jumps';

export const HEAT_METRICS: HeatMetric[] = ['none', 'fleet', 'shipKills', 'podKills', 'npcKills', 'jumps'];

// Glow colour per metric (fed to the node ::before via --heat-color).
export const HEAT_COLORS: Record<Exclude<HeatMetric, 'none'>, string> = {
  fleet:     '#c084fc', // purple
  shipKills: '#ef4444', // red
  podKills:  '#f97316', // orange
  npcKills:  '#eab308', // yellow
  jumps:     '#4d9de0', // blue
};

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
