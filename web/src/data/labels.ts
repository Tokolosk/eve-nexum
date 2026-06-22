// Per-system labels shown as coloured pill badges above the node. Two kinds:
//  - predefined: a fixed toggleable set (A/B/C/1/2/3), each its own colour;
//  - custom: up to MAX_CUSTOM_LABELS user entries, each free text OR a Phosphor
//    icon, encoded as 't:<text>' / 'i:<IconName>' in MapSystem.customLabels.
// Persisted via the same updateSystem path intel uses; rendered in SystemNode.

export interface LabelDef {
  id:    string;  // stored value in MapSystem.labels
  char:  string;  // pill glyph
  color: string;  // CSS var (defined in App.css)
}

// Fixed order — pills render in this order, filtered by what the system has.
export const PREDEFINED_LABELS: LabelDef[] = [
  { id: 'a', char: 'A', color: 'var(--label-a)' },
  { id: 'b', char: 'B', color: 'var(--label-b)' },
  { id: 'c', char: 'C', color: 'var(--label-c)' },
  { id: '1', char: '1', color: 'var(--label-1)' },
  { id: '2', char: '2', color: 'var(--label-2)' },
  { id: '3', char: '3', color: 'var(--label-3)' },
];

export const PREDEFINED_LABEL_IDS = PREDEFINED_LABELS.map((l) => l.id);

export const MAX_CUSTOM_LABELS = 3;

export type CustomLabel =
  | { kind: 'text'; value: string }
  | { kind: 'icon'; value: string };

export function parseCustomLabel(raw: string): CustomLabel | null {
  if (raw.startsWith('t:')) return { kind: 'text', value: raw.slice(2) };
  if (raw.startsWith('i:')) return { kind: 'icon', value: raw.slice(2) };
  return null;
}

export const encodeTextLabel = (text: string): string => `t:${text}`;
export const encodeIconLabel = (iconName: string): string => `i:${iconName}`;
