// Wormhole rolling math. See rolling_calc_feature.md.
//
// A wormhole's *actual* collapse threshold is uniformly somewhere in
// ±MASS_VARIANCE of the nominal total mass. Every "is the next pass safe"
// decision is made against the *worst* case (0.9·T) so we never collapse a
// hole — or strand a roller — earlier than predicted.

export const MASS_VARIANCE = 0.1; // ±10%

export type CollapseState = 'open' | 'maybe' | 'collapsed';
export type PassOutcome   = 'safe' | 'risky' | 'collapse';
export type RollSide      = 'home' | 'far';

export interface MassRange {
  nominalTotal:   number;
  worstTotal:     number; // 0.9·T — collapses soonest; decisions use this
  bestTotal:      number; // 1.1·T
  worstRemaining: number;
  bestRemaining:  number;
}

export function massRange(totalMass: number, massUsed: number): MassRange {
  const worstTotal = totalMass * (1 - MASS_VARIANCE);
  const bestTotal  = totalMass * (1 + MASS_VARIANCE);
  return {
    nominalTotal:   totalMass,
    worstTotal,
    bestTotal,
    worstRemaining: Math.max(0, worstTotal - massUsed),
    bestRemaining:  Math.max(0, bestTotal  - massUsed),
  };
}

export function collapseState(totalMass: number, massUsed: number): CollapseState {
  const { worstTotal, bestTotal } = massRange(totalMass, massUsed);
  if (massUsed >= bestTotal)  return 'collapsed';
  if (massUsed >= worstTotal) return 'maybe';
  return 'open';
}

// Outcome of pushing `passMass` more through, from the current `massUsed`.
export function passOutcome(totalMass: number, massUsed: number, passMass: number): PassOutcome {
  const after = massUsed + passMass;
  const { worstTotal, bestTotal } = massRange(totalMass, massUsed);
  if (after < worstTotal) return 'safe';     // cannot collapse
  if (after < bestTotal)  return 'risky';    // might collapse
  return 'collapse';                         // will collapse
}

// Passes of `passMass` that are guaranteed safe (worst case) and the optimistic
// (best case) count — drives the "≈ a–b passes left" summary.
export function safePassesLeft(totalMass: number, massUsed: number, passMass: number): { min: number; max: number } {
  if (passMass <= 0) return { min: 0, max: 0 };
  const { worstRemaining, bestRemaining } = massRange(totalMass, massUsed);
  return {
    min: Math.max(0, Math.floor(worstRemaining / passMass)),
    max: Math.max(0, Math.floor(bestRemaining  / passMass)),
  };
}

export const flipSide = (s: RollSide): RollSide => (s === 'home' ? 'far' : 'home');

// ---- Roller ships -------------------------------------------------------

export interface RollerShip {
  name:   string;
  coldKg: number; // mass with no prop mod running
  hotKg:  number; // mass with the prop mod active
}

// 100MN prop module mass add — used to estimate a hot mass from a cold one
// ("Use my ship"). Players tune the real numbers for their fit anyway.
export const PROP_MASS = 50_000_000;

// Starting points only; every field is editable. Cold/hot mirror the app's
// long-standing battleship presets (100 / 200 M kg).
export const ROLLER_PRESETS: RollerShip[] = [
  { name: 'Battleship',         coldKg: 100_000_000, hotKg: 200_000_000 },
  { name: 'Battleship + Higgs', coldKg: 200_000_000, hotKg: 300_000_000 },
  { name: 'HIC',                coldKg:  15_000_000, hotKg:  22_000_000 },
];

// ---- Persistence --------------------------------------------------------

const ROLLER_KEY = 'nexum.roller';

export function loadRoller(): RollerShip {
  try {
    const raw = localStorage.getItem(ROLLER_KEY);
    if (raw) {
      const r = JSON.parse(raw);
      if (typeof r?.coldKg === 'number' && typeof r?.hotKg === 'number') {
        return { name: String(r.name ?? 'Roller'), coldKg: r.coldKg, hotKg: r.hotKg };
      }
    }
  } catch { /* quota / private mode / bad json */ }
  return { ...ROLLER_PRESETS[0] };
}

export function saveRoller(r: RollerShip): void {
  try { localStorage.setItem(ROLLER_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

// Per-connection roll session: which side the roller is on and the stack of
// applied pass masses (so a pass can be undone). Local to this pilot — side is
// a property of the person rolling, not the shared hole.
export interface RollSession { side: RollSide; stack: number[]; }

const sessionKey = (connId: string) => `nexum.roll.${connId}`;

export function loadSession(connId: string | undefined): RollSession {
  if (!connId) return { side: 'home', stack: [] };
  try {
    const raw = localStorage.getItem(sessionKey(connId));
    if (raw) {
      const s = JSON.parse(raw);
      if ((s?.side === 'home' || s?.side === 'far') && Array.isArray(s?.stack)) {
        return { side: s.side, stack: s.stack.filter((n: unknown) => typeof n === 'number') };
      }
    }
  } catch { /* ignore */ }
  return { side: 'home', stack: [] };
}

export function saveSession(connId: string, s: RollSession): void {
  try { localStorage.setItem(sessionKey(connId), JSON.stringify(s)); } catch { /* ignore */ }
}
