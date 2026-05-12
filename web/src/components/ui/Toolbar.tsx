import { useState, useEffect } from 'react';
import { useMapStore } from '../../store/mapStore';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { UserStatsModal } from './UserStatsModal';

interface EveStatus {
  players:    number;
  serverUp:   boolean; // 200 from status endpoint
  esiOnline:  boolean; // fetch reached ESI at all
}

function useEveServerStatus(): EveStatus | null {
  const [status, setStatus] = useState<EveStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      let esiOnline = false;
      let serverUp  = false;
      let players   = 0;
      try {
        const res = await fetch('https://esi.evetech.net/latest/status/?datasource=tranquility', {
          signal: AbortSignal.timeout(10_000),
        });
        esiOnline = true;
        if (res.ok) {
          const data = await res.json() as { players?: number };
          serverUp = true;
          players  = data.players ?? 0;
        }
      } catch {
        // esiOnline stays false
      }
      if (!cancelled) setStatus({ players, serverUp, esiOnline });
    }

    poll();
    const id = setInterval(poll, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return status;
}

function formatCheckedAt(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

// Ticks every 5 s so the "Xs ago" label stays fresh
function useNow() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);
}

export function Toolbar() {
  const { map, maps, maxMaps, activeMapId, setMapName, switchMap, createMap, deleteMap,
          mapOptionsOpen, setMapOptionsOpen } = useMapStore();
  const atMapLimit = maps.length >= maxMaps;
  const { user, logout } = useAuth();
  const { online, checkedAt } = useOnlineStatus(!!user);
  const eveStatus = useEveServerStatus();
  useNow();
  const [showMaps, setShowMaps]   = useState(false);
  const [showStats, setShowStats] = useState(false);

  async function handleNewMap() {
    const name = prompt('Map name:', 'New Map');
    if (name) await createMap(name);
  }

  async function handleDeleteMap() {
    if (!activeMapId) return;
    if (confirm(`Delete "${map.name}"? This cannot be undone.`)) {
      await deleteMap(activeMapId);
    }
  }

  return (
    <>
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo">◈</span>
      </div>

      {/* Map switcher */}
      <div className="toolbar__map-switcher">
        <button
          className="toolbar__map-name-btn"
          onClick={() => setShowMaps((v) => !v)}
          title="Switch map"
        >
          {map.name || 'No Map'}
          <span className="toolbar__caret">▾</span>
        </button>

        {showMaps && (
          <div className="map-dropdown" onMouseLeave={() => setShowMaps(false)}>
            {maps.map((m) => (
              <button
                key={m.id}
                className={`map-dropdown__item${m.id === activeMapId ? ' map-dropdown__item--active' : ''}`}
                onClick={() => { switchMap(m.id); setShowMaps(false); }}
              >
                {m.name}
              </button>
            ))}
            <div className="map-dropdown__divider" />
            <span
              className={`map-dropdown__new-wrap${atMapLimit ? ' map-dropdown__new-wrap--disabled' : ''}`}
            >
              <button
                className="map-dropdown__item map-dropdown__item--action"
                onClick={() => { setShowMaps(false); handleNewMap(); }}
                disabled={atMapLimit}
              >
                + New Map
              </button>
            </span>
            {maps.length > 1 && (
              <button className="map-dropdown__item map-dropdown__item--danger" onClick={() => { setShowMaps(false); handleDeleteMap(); }}>
                Delete this map
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map name edit */}
      <div className="toolbar__option">
        <label className="toolbar__option-label" htmlFor="map-name">Name</label>
        <input
          id="map-name"
          className="toolbar__map-name"
          value={map.name}
          onChange={(e) => setMapName(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="toolbar__spacer" />

      <div className="toolbar__stats">
        <span>{map.systems.length} systems</span>
        <span>{map.connections.length} connections</span>
      </div>

      <div className="toolbar__spacer" />

      <button
        className="toolbar__toggle"
        onClick={() => setShowStats(true)}
      >
        User Stats
      </button>

      <button
        className={`toolbar__toggle${mapOptionsOpen ? ' toolbar__toggle--on' : ''}`}
        onClick={() => setMapOptionsOpen(!mapOptionsOpen)}
        aria-pressed={mapOptionsOpen}
      >
        Map Options
      </button>

      <div className="toolbar__server-status">
        <div className="toolbar__server-row">
          <span
            className={`toolbar__status-dot${
              eveStatus == null ? '' :
              eveStatus.serverUp ? ' toolbar__status-dot--on' : ' toolbar__status-dot--off'
            }`}
            data-tooltip={
              eveStatus == null ? 'Checking…' :
              eveStatus.serverUp ? 'Tranquility: Online' : 'Tranquility: Offline'
            }
          />
          <span className="toolbar__server-label">TQ</span>
          {eveStatus?.serverUp && (
            <span className="toolbar__player-count">
              {eveStatus.players.toLocaleString()}
            </span>
          )}
        </div>
        <div className="toolbar__server-row">
          <span
            className={`toolbar__status-dot${
              eveStatus == null ? '' :
              eveStatus.esiOnline ? ' toolbar__status-dot--on' : ' toolbar__status-dot--off'
            }`}
            data-tooltip={
              eveStatus == null ? 'Checking…' :
              eveStatus.esiOnline ? 'ESI: Online' : 'ESI: Offline'
            }
          />
          <span className="toolbar__server-label">ESI</span>
        </div>
      </div>

      {user && (
        <div className="toolbar__user">
          <span
            className={`toolbar__online-dot${online === true ? ' toolbar__online-dot--on' : online === false ? ' toolbar__online-dot--off' : ''}`}
            title={online === true ? 'Online in EVE' : online === false ? 'Offline' : 'Status unknown'}
          />
          <img
            className="toolbar__avatar"
            src={`https://images.evetech.net/characters/${user.characterId}/portrait?size=64`}
            alt={user.characterName}
          />
          <div className="toolbar__char-info">
            <span className="toolbar__char-name">{user.characterName}</span>
            {checkedAt && (
              <span className="toolbar__checked-at">
                checked {formatCheckedAt(checkedAt)}
              </span>
            )}
          </div>
          <button className="btn btn--ghost btn--sm" onClick={logout}>Logout</button>
        </div>
      )}
    </header>

    {showStats && <UserStatsModal onClose={() => setShowStats(false)} />}
    </>
  );
}
