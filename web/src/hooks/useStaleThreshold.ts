import { useEffect, useState } from 'react';

const KEY = 'nexum.staleThresholdH';
const DEFAULT_H = 24;

function read(): number {
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_H;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_H;
  return n;
}

export function useStaleThreshold(): [number, (h: number) => void] {
  const [v, setV] = useState<number>(() => read());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setV(read()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return [
    v,
    (h: number) => { localStorage.setItem(KEY, String(Math.max(1, Math.floor(h)))); setV(read()); },
  ];
}
