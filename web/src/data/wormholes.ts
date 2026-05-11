import type { SystemClass, WormholeEffect } from '../types';

export const CLASS_COLORS: Record<SystemClass, string> = {
  C1: '#3a6bc4',
  C2: '#2e85c4',
  C3: '#2a9b7a',
  C4: '#2a7a5a',
  C5: '#c45a2a',
  C6: '#c42a2a',
  C13: '#8a3ac4',
  HS: '#4caf50',
  LS: '#c4a42a',
  NS: '#7b3fc4',
  Thera: '#c42a8a',
  Pochven: '#8a2ac4',
  Drifter: '#555577',
};

export const CLASS_LABELS: Record<SystemClass, string> = {
  C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4', C5: 'C5', C6: 'C6', C13: 'C13',
  HS: 'Hi-Sec', LS: 'Low-Sec', NS: 'Null-Sec',
  Thera: 'Thera', Pochven: 'Pochven', Drifter: 'Drifter',
};

export const EFFECT_LABELS: Record<WormholeEffect, string> = {
  none: '',
  pulsar: 'Pulsar',
  black_hole: 'Black Hole',
  cataclysmic_variable: 'Cataclysmic',
  magnetar: 'Magnetar',
  red_giant: 'Red Giant',
  wolf_rayet: 'Wolf-Rayet',
};

// Wormhole type code → destination class
export const WORMHOLE_DESTINATIONS: Record<string, SystemClass> = {
  // → C1
  P060: 'C1', Q317: 'C1', Y790: 'C1', Z647: 'C1', Z971: 'C1',
  // → C2
  D364: 'C2', D382: 'C2', G024: 'C2', N766: 'C2',
  // → C3
  C247: 'C3', L477: 'C3', M267: 'C3', O477: 'C3',
  // → C4
  E175: 'C4', X877: 'C4', Y683: 'C4', Z457: 'C4',
  // → C5
  H296: 'C5', H900: 'C5', N062: 'C5', V911: 'C5',
  // → C6
  R474: 'C6', U574: 'C6', V753: 'C6', W237: 'C6',
  // → Hi-Sec
  B274: 'HS', D845: 'HS', N110: 'HS', Q063: 'HS',
  // → Low-Sec
  A239: 'LS', J244: 'LS', N432: 'LS', U210: 'LS', V898: 'LS',
  // → Null-Sec
  E545: 'NS', E587: 'NS', K346: 'NS', S047: 'NS', Z060: 'NS',
  // → Thera
  F135: 'Thera', F353: 'Thera', L031: 'Thera', M164: 'Thera', T458: 'Thera',
  // → C13 (shattered)
  A009: 'C13',
  // → Drifter
  B735: 'Drifter', C414: 'Drifter', R259: 'Drifter', S877: 'Drifter', V928: 'Drifter',
  // → frigate-only
  E004: 'C1', L005: 'C2', Z006: 'C3', M001: 'C4', C008: 'C5', G008: 'C6', Q003: 'NS',
};

// Grouped WH types for the picker UI (ordered for display)
export const WH_GROUPS: { key: string; label: string; types: string[] }[] = [
  { key: 'k162',    label: 'K162',     types: ['K162'] },
  { key: 'frigate', label: 'Frigate',  types: ['E004', 'L005', 'Z006', 'M001', 'C008', 'G008', 'Q003', 'A009'] },
  { key: 'highsec', label: 'Hi-Sec',   types: ['B274', 'D845', 'N110', 'Q063'] },
  { key: 'lowsec',  label: 'Low-Sec',  types: ['A239', 'J244', 'N432', 'U210', 'V898'] },
  { key: 'nullsec', label: 'Null-Sec', types: ['E545', 'E587', 'K346', 'S047', 'Z060'] },
  { key: 'c1',      label: 'Class 1',  types: ['E004', 'P060', 'Q317', 'Y790', 'Z647', 'Z971'] },
  { key: 'c2',      label: 'Class 2',  types: ['D364', 'D382', 'G024', 'L005', 'N766'] },
  { key: 'c3',      label: 'Class 3',  types: ['C247', 'L477', 'M267', 'O477', 'Z006'] },
  { key: 'c4',      label: 'Class 4',  types: ['E175', 'M001', 'X877', 'Y683', 'Z457'] },
  { key: 'c5',      label: 'Class 5',  types: ['C008', 'H296', 'H900', 'N062', 'V911'] },
  { key: 'c6',      label: 'Class 6',  types: ['G008', 'R474', 'U574', 'V753', 'W237'] },
  { key: 'thera',   label: 'Thera',    types: ['F135', 'F353', 'L031', 'M164', 'T458'] },
  { key: 'drifter', label: 'Drifter',  types: ['B735', 'C414', 'R259', 'S877', 'V928'] },
];

export const WORMHOLE_TYPES: Record<string, { leadsTo: SystemClass; maxMassKg: number; jumpMassKg: number; lifetimeH: number }> = {
  K162:  { leadsTo: 'C1', maxMassKg: 0,          jumpMassKg: 0,         lifetimeH: 24 },
  Z060:  { leadsTo: 'HS', maxMassKg: 500_000_000,  jumpMassKg: 20_000_000, lifetimeH: 16 },
  B274:  { leadsTo: 'HS', maxMassKg: 2_000_000_000, jumpMassKg: 300_000_000, lifetimeH: 24 },
  N110:  { leadsTo: 'C1', maxMassKg: 500_000_000,  jumpMassKg: 20_000_000, lifetimeH: 16 },
  C247:  { leadsTo: 'C3', maxMassKg: 1_800_000_000, jumpMassKg: 300_000_000, lifetimeH: 16 },
  X877:  { leadsTo: 'C4', maxMassKg: 2_000_000_000, jumpMassKg: 300_000_000, lifetimeH: 16 },
  D382:  { leadsTo: 'C5', maxMassKg: 3_000_000_000, jumpMassKg: 1_000_000_000, lifetimeH: 16 },
  W237:  { leadsTo: 'C6', maxMassKg: 3_000_000_000, jumpMassKg: 1_000_000_000, lifetimeH: 24 },
  S047:  { leadsTo: 'NS', maxMassKg: 2_000_000_000, jumpMassKg: 300_000_000, lifetimeH: 16 },
  N432:  { leadsTo: 'LS', maxMassKg: 2_000_000_000, jumpMassKg: 300_000_000, lifetimeH: 16 },
};

export const SYSTEM_CLASSES: SystemClass[] = [
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C13',
  'HS', 'LS', 'NS', 'Thera', 'Pochven', 'Drifter',
];

export const WORMHOLE_EFFECTS: WormholeEffect[] = [
  'none', 'pulsar', 'black_hole', 'cataclysmic_variable', 'magnetar', 'red_giant', 'wolf_rayet',
];

export const EFFECT_ICONS: Record<WormholeEffect, { symbol: string; color: string }> = {
  none:                 { symbol: '',  color: '' },
  pulsar:               { symbol: '⚡', color: '#4db8ff' },
  black_hole:           { symbol: '◉', color: '#8888aa' },
  cataclysmic_variable: { symbol: '⟳', color: '#aa55ff' },
  magnetar:             { symbol: '✦', color: '#ff9900' },
  red_giant:            { symbol: '★', color: '#ff5522' },
  wolf_rayet:           { symbol: '⚔', color: '#44dd88' },
};

export const EFFECT_MODIFIERS: Record<WormholeEffect, Array<{ label: string; good: boolean }>> = {
  none: [],
  pulsar: [
    { label: 'Shield HP',      good: true  },
    { label: 'Cap Recharge',   good: true  },
    { label: 'Armor HP',       good: false },
    { label: 'Cap Size',       good: false },
  ],
  black_hole: [
    { label: 'Ship Speed',         good: true  },
    { label: 'Missile Speed',      good: true  },
    { label: 'Stasis Web Str',     good: false },
    { label: 'Target Painter Str', good: false },
    { label: 'Explosion Radius',   good: false },
  ],
  cataclysmic_variable: [
    { label: 'Local Rep',    good: true  },
    { label: 'Cap Recharge', good: true  },
    { label: 'Remote Rep',   good: false },
    { label: 'Cap Size',     good: false },
  ],
  magnetar: [
    { label: 'Drone Damage',      good: true  },
    { label: 'Targeting Range',   good: false },
    { label: 'Drone Range',       good: false },
    { label: 'Explosion Radius',  good: false },
  ],
  red_giant: [
    { label: 'Overheat Bonus',  good: true  },
    { label: 'Smartbomb Range', good: true  },
    { label: 'Heat Damage',     good: false },
  ],
  wolf_rayet: [
    { label: 'Small Weapons',    good: true  },
    { label: 'Armor HP',         good: true  },
    { label: 'Sig Radius',       good: true  },
    { label: 'Shield HP',        good: false },
  ],
};
