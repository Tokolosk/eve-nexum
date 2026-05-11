import { useRef } from 'react';
import { useMapStore } from '../../store/mapStore';
import { api } from '../../api/client';
import type { WormholeMap } from '../../types';

export function MapSidebar() {
  const importInputRef = useRef<HTMLInputElement>(null);

  const {
    map, maps, maxMaps,
    snapToGrid, setSnapToGrid,
    compactMode, setCompactMode,
    showMinimap, setShowMinimap,
    easyConnect, setEasyConnect,
    mapOptionsOpen, setMapOptionsOpen,
    edgeStyle, setEdgeStyle,
    updateConnection, requestAutoLayout,
  } = useMapStore();

  const atMapLimit = maps.length >= maxMaps;

  function handleOptimizeConnections() {
    const systemMap = new Map(map.systems.map((s) => [s.id, s.position]));
    for (const conn of map.connections) {
      const src = systemMap.get(conn.sourceId);
      const tgt = systemMap.get(conn.targetId);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const sourceHandle = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
      const targetHandle = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'left' : 'right') : (dy >= 0 ? 'top' : 'bottom');
      if (conn.sourceHandle !== sourceHandle || conn.targetHandle !== targetHandle) {
        updateConnection(conn.id, { sourceHandle, targetHandle });
      }
    }
  }

  function handleExport() {
    const json = JSON.stringify(map, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${map.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    let parsed: WormholeMap;
    try {
      parsed = JSON.parse(await file.text()) as WormholeMap;
    } catch {
      alert('Invalid JSON file.');
      return;
    }
    if (!parsed.systems || !parsed.connections) {
      alert('File does not look like a Eve-Nexum map export.');
      return;
    }
    try {
      const { id } = await api<{ id: string }>('/api/maps/import', {
        method: 'POST',
        body: JSON.stringify({ name: parsed.name, systems: parsed.systems, connections: parsed.connections }),
      });
      await useMapStore.getState().loadMaps();
      await useMapStore.getState().switchMap(id);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className={`map-sidebar${mapOptionsOpen ? ' map-sidebar--open' : ''}`}>
      <button
        className="map-sidebar__tab"
        onClick={() => setMapOptionsOpen(!mapOptionsOpen)}
        title={mapOptionsOpen ? 'Close map options' : 'Map options'}
      >
        {mapOptionsOpen ? '›' : '‹'}
      </button>

      <div className="map-sidebar__content">
        <div className="map-sidebar__title">Map Options</div>

        <div className="map-sidebar__section">
          <div className="map-sidebar__row">
            <label className="map-sidebar__label">Snap to Grid</label>
            <button
              className={`toolbar__toggle${snapToGrid ? ' toolbar__toggle--on' : ''}`}
              onClick={() => setSnapToGrid(!snapToGrid)}
              aria-pressed={snapToGrid}
            >
              {snapToGrid ? 'On' : 'Off'}
            </button>
          </div>

          <div className="map-sidebar__row">
            <label className="map-sidebar__label">Compact</label>
            <button
              className={`toolbar__toggle${compactMode ? ' toolbar__toggle--on' : ''}`}
              onClick={() => setCompactMode(!compactMode)}
              aria-pressed={compactMode}
            >
              {compactMode ? 'On' : 'Off'}
            </button>
          </div>

          <div className="map-sidebar__row">
            <label className="map-sidebar__label">Minimap</label>
            <button
              className={`toolbar__toggle${showMinimap ? ' toolbar__toggle--on' : ''}`}
              onClick={() => setShowMinimap(!showMinimap)}
              aria-pressed={showMinimap}
            >
              {showMinimap ? 'On' : 'Off'}
            </button>
          </div>

          <div className="map-sidebar__row">
            <label className="map-sidebar__label">Easy Connect</label>
            <button
              className={`toolbar__toggle${easyConnect ? ' toolbar__toggle--on' : ''}`}
              onClick={() => setEasyConnect(!easyConnect)}
              aria-pressed={easyConnect}
            >
              {easyConnect ? 'On' : 'Off'}
            </button>
          </div>
        </div>

                <div className="map-sidebar__divider" />

        <div className="map-sidebar__section">
          <button
            className="map-sidebar__action"
            onClick={handleOptimizeConnections}
            disabled={map.connections.length === 0}
          >
            ⟳ Optimize Connections
          </button>
          <button
            className="map-sidebar__action"
            onClick={requestAutoLayout}
            disabled={map.systems.length < 2}
          >
            ⊞ Spread Nodes
          </button>
        </div>

        <div className="map-sidebar__divider" />

        <div className="map-sidebar__section">
          <div className="map-sidebar__label" style={{ marginBottom: 6 }}>Connection Style</div>
          <div className="map-sidebar__btn-group">
            {([
              { value: 'bezier',     label: 'Standard' },
              { value: 'straight',   label: 'Straight' },
              { value: 'smoothstep', label: 'Step' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                className={`map-sidebar__btn-group-item${edgeStyle === value ? ' map-sidebar__btn-group-item--active' : ''}`}
                onClick={() => setEdgeStyle(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>



        <div className="map-sidebar__divider" />

        <div className="map-sidebar__section">
          <button className="map-sidebar__action" onClick={handleExport}>
            ↓ Export as JSON
          </button>

          <div className={`map-sidebar__import-wrap${atMapLimit ? ' map-sidebar__import-wrap--disabled' : ''}`}>
            <button
              className="map-sidebar__action"
              onClick={() => importInputRef.current?.click()}
              disabled={atMapLimit}
            >
              ↑ Import from JSON
            </button>
          </div>
        </div>
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
