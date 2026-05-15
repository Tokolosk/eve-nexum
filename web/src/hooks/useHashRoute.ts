import { useEffect, useState } from 'react';

// Lightweight hash-based router. Returns the current path part of the hash
// (e.g. '/admin/users') and a setter that updates the URL via location.hash.
// We deliberately don't pull in react-router — the app only has two top-level
// views right now, and the admin section needs at most one level of nesting.
export function useHashRoute(): [string, (path: string) => void] {
  const [path, setPath] = useState<string>(() => readPath());

  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = (next: string) => {
    if (readPath() === next) return;
    window.location.hash = next.startsWith('#') ? next : `#${next}`;
  };

  return [path, navigate];
}

function readPath(): string {
  const raw = window.location.hash || '';
  // Strip the leading '#' but keep the '/' so paths are absolute.
  return raw.startsWith('#') ? raw.slice(1) : raw;
}
