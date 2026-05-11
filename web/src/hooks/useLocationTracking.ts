import { useCallback, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useMapStore } from '../store/mapStore';
import type { SystemClass, WormholeEffect } from '../types';

const POLL_MS = 5_000;

interface LocationResponse {
  online: boolean;
  system: {
    eveSystemId: number;
    name: string;
    systemClass: string;
    effect: string;
    statics: string[];
    regionName: string | null;
    npcType: string | null;
  } | null;
}

export function useLocationTracking(enabled: boolean) {
  const lastEveSystemId  = useRef<number | null>(null);
  const lastMapSystemId  = useRef<string | null>(null);
  const lastActiveMapId  = useRef<string | null>(null);

  const check = useCallback(async () => {
    if (!enabled) return;
    try {
      const { online, system } = await api<LocationResponse>('/api/character/location');
      const { map, addSystem, addConnection, selectSystem, setCurrentSystem } = useMapStore.getState();

      // Reset refs when the active map changes
      if (map.id !== lastActiveMapId.current) {
        lastActiveMapId.current = map.id;
        lastEveSystemId.current = null;
        lastMapSystemId.current = null;
      }

      if (!online || !system) {
        lastEveSystemId.current = null;
        lastMapSystemId.current = null;
        setCurrentSystem(null);
        return;
      }

      if (system.eveSystemId === lastEveSystemId.current) return;

      const prevMapSystemId = lastMapSystemId.current;
      lastEveSystemId.current = system.eveSystemId;

      let mapSystemId: string;
      const existing = map.systems.find((s) => s.eveSystemId === system.eveSystemId);
      if (existing) {
        mapSystemId = existing.id;
      } else {
        let position: { x: number; y: number };
        if (prevMapSystemId) {
          const prevSys = map.systems.find((s) => s.id === prevMapSystemId);
          position = prevSys
            ? { x: prevSys.position.x + 200, y: prevSys.position.y }
            : { x: 200, y: 0 };
        } else {
          const cx = map.systems.length
            ? map.systems.reduce((sum, s) => sum + s.position.x, 0) / map.systems.length
            : 0;
          const cy = map.systems.length
            ? map.systems.reduce((sum, s) => sum + s.position.y, 0) / map.systems.length
            : 0;
          position = { x: cx + 200, y: cy };
        }

        mapSystemId = addSystem(
          system.name,
          system.systemClass as SystemClass,
          position,
          {
            eveSystemId: system.eveSystemId,
            effect: system.effect as WormholeEffect,
            statics: system.statics,
            regionName: system.regionName,
            npcType: system.npcType,
          },
        );
      }

      if (prevMapSystemId && prevMapSystemId !== mapSystemId) {
        const freshConnections = useMapStore.getState().map.connections;
        const alreadyConnected = freshConnections.some(
          (c) =>
            (c.sourceId === prevMapSystemId && c.targetId === mapSystemId) ||
            (c.sourceId === mapSystemId && c.targetId === prevMapSystemId),
        );
        if (!alreadyConnected) addConnection(prevMapSystemId, mapSystemId, 'right', 'left');
      }

      lastMapSystemId.current = mapSystemId;
      setCurrentSystem(mapSystemId);
      selectSystem(mapSystemId);
    } catch {
      // ignore transient errors
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, check]);
}
