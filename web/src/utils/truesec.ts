export function truesecColor(sec: number): string {
  if (sec >= 0.9) return '#2aff85';
  if (sec >= 0.8) return '#00ff66';
  if (sec >= 0.7) return '#00ff33';
  if (sec >= 0.6) return '#55ff00';
  if (sec >= 0.5) return '#99ff00';
  if (sec >= 0.4) return '#ffff00';
  if (sec >= 0.3) return '#ff9900';
  if (sec >= 0.1) return '#ff6600';
  if (sec >  0.0) return '#ff3300';
  return '#ff0000';
}
