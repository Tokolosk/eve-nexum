import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

const POLL_MS = 30_000;

interface OnlineStatus {
  online: boolean | null;
  checkedAt: Date | null;
}

export function useOnlineStatus(enabled: boolean): OnlineStatus {
  const [online, setOnline]       = useState<boolean | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await api<{ online: boolean | null; scopeMissing?: boolean }>('/api/character/online');
      setOnline(data.scopeMissing ? null : data.online);
      setCheckedAt(new Date());
    } catch {
      setOnline(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, check]);

  return { online, checkedAt };
}
