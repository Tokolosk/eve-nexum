import { useMapStore } from '../../store/mapStore';
import type { MassStatus, TimeStatus, ConnectionSize } from '../../types';

export function ConnectionPanel() {
  const { map, selectedConnectionId, updateConnection, removeConnection, selectConnection } =
    useMapStore();

  const conn = map.connections.find((c) => c.id === selectedConnectionId);
  if (!conn) return null;

  const src = map.systems.find((s) => s.id === conn.sourceId);
  const tgt = map.systems.find((s) => s.id === conn.targetId);

  const update = (updates: Parameters<typeof updateConnection>[1]) =>
    updateConnection(conn.id, updates);

  return (
    <aside className="system-panel">
      <div className="system-panel__header">
        <h2 className="system-panel__title">
          {src?.name ?? '?'} → {tgt?.name ?? '?'}
        </h2>
        <button className="icon-btn" onClick={() => selectConnection(null)} title="Close">✕</button>
      </div>

      <label className="field">
        <span>Wormhole type</span>
        <input
          type="text"
          value={conn.type ?? ''}
          onChange={(e) => update({ type: e.target.value || null })}
          placeholder="K162, C247…"
        />
      </label>

      <label className="field">
        <span>Mass status</span>
        <select
          value={conn.massStatus ?? ''}
          onChange={(e) => update({ massStatus: e.target.value as MassStatus })}
        >
          <option value="stable">Stable</option>
          <option value="destabilized">Destabilized (&lt;50%)</option>
          <option value="critical">Critical (&lt;10%)</option>
        </select>
      </label>

      <label className="field">
        <span>Time status</span>
        <select
          value={conn.timeStatus ?? ''}
          onChange={(e) => update({ timeStatus: e.target.value as TimeStatus })}
        >
          <option value="fresh">Fresh</option>
          <option value="eol">End of Life</option>
        </select>
      </label>

      <label className="field">
        <span>Size</span>
        <select
          value={conn.size}
          onChange={(e) => update({ size: e.target.value as ConnectionSize })}
        >
          <option value="xl">XL (Freighter)</option>
          <option value="large">Large (Battleship)</option>
          <option value="medium">Medium (Cruiser)</option>
          <option value="small">Small (Frigate)</option>
        </select>
      </label>

      <button
        className="btn btn--danger"
        onClick={() => { removeConnection(conn.id); }}
      >
        Remove Connection
      </button>
    </aside>
  );
}
