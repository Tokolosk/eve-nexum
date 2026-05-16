// Shared in-memory cache for corp / alliance metadata fetched from ESI.
// Used by the sov panel, the killboard, and the standings card so they
// don't each spam ESI separately for the same IDs.

const ESI = 'https://esi.evetech.net/latest';

export interface EntityInfo { name: string; ticker: string }

const cache    = new Map<string, EntityInfo | null>();
const inflight = new Map<string, Promise<EntityInfo | null>>();

export function fetchEntityInfo(
  kind: 'alliances' | 'corporations',
  id: number,
): Promise<EntityInfo | null> {
  const key = `${kind}:${id}`;
  if (cache.has(key))    return Promise.resolve(cache.get(key) ?? null);
  if (inflight.has(key)) return inflight.get(key)!;

  const url     = kind === 'alliances'
    ? `${ESI}/alliances/${id}/`
    : `${ESI}/corporations/${id}/`;

  const promise = fetch(url)
    .then((r) => r.ok ? r.json() as Promise<{ name: string; ticker: string }> : null)
    .then((data) => {
      const info: EntityInfo | null = data ? { name: data.name, ticker: data.ticker } : null;
      cache.set(key, info);
      return info;
    })
    .catch(() => { cache.set(key, null); return null; })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
