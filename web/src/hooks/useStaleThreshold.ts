import { useUserSetting } from './useUserSetting';

const KEY = 'nexum.staleThresholdH';
// 30 days × 24 hours — chains move fast in some wormholes, slow in others,
// so a month covers most "is this still relevant?" cases without forcing
// users to bump it on first use.
const DEFAULT_H = 24 * 30;

export function useStaleThreshold(): [number, (h: number) => void] {
  const [v, setV] = useUserSetting<number>(KEY, DEFAULT_H);
  // Clamp on write. Legacy localStorage values that came through as
  // `'720'` parse to number 720 fine; brand-new users get DEFAULT_H.
  return [
    Number.isFinite(v) && v > 0 ? v : DEFAULT_H,
    (h: number) => setV(Math.max(1, Math.floor(h))),
  ];
}
