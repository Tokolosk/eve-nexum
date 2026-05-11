import { useState, useEffect, useRef } from 'react';

export interface SystemSearchResult {
  id: number;
  name: string;
  security: number;
  systemClass: string;
}

export interface SystemDetail extends SystemSearchResult {
  effect: string;
  statics: string[];
  regionName?: string;
  npcType?: string;
}

export async function fetchSystemDetail(id: number): Promise<SystemDetail> {
  const res = await fetch(`/api/systems/${id}`);
  if (!res.ok) throw new Error('System lookup failed');
  return res.json();
}

export function useEsiSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<SystemSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/systems/search?q=${encodeURIComponent(query)}`,
          { signal: abortRef.current.signal },
        );
        if (!res.ok) throw new Error('Search failed');
        setResults(await res.json());
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError('Search failed');
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return { results, loading, error };
}
