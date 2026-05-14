import { useMapStore } from '../store/mapStore';
import type { Signature } from '../types';

/**
 * After a signature was edited or deleted, re-evaluate every connection that
 * touches `systemId` against the latest set of sigs on this system.
 *
 * For each such connection:
 *  - If any sig backs the link (whType + whLeadsTo, where whLeadsTo matches the
 *    other endpoint by class OR by name), fill / upgrade conn.type with the
 *    best non-K162 match.
 *  - If no sig backs it any more AND the previously-edited sig used to back
 *    it AND conn.type still matches that old whType, clear the connection
 *    back to `null` (so it's eligible for auto-fill again).
 *  - User-cleared connections (conn.type === '') and unrelated manual values
 *    are left alone.
 *
 * The `oldSig` argument is the sig's state BEFORE the edit/delete — it lets us
 * detect "this sig used to back this connection" so we don't accidentally
 * clear a value the user typed manually.
 */
export function reevaluateConnectionsForSystem(
  systemId: string,
  allSigs:  Signature[],
  oldSig:   Signature | undefined,
): void {
  const { map, updateConnection } = useMapStore.getState();

  for (const conn of map.connections) {
    const otherId =
      conn.sourceId === systemId ? conn.targetId :
      conn.targetId === systemId ? conn.sourceId :
      null;
    if (!otherId) continue;
    const otherSys = map.systems.find(s => s.id === otherId);
    if (!otherSys) continue;
    const oc = otherSys.systemClass.toUpperCase();
    const on = (otherSys.name ?? '').toUpperCase();

    const backingCodes: string[] = [];
    for (const s of allSigs) {
      if (!s.whType || !s.whLeadsTo) continue;
      const target = s.whLeadsTo.toUpperCase();
      if (target === oc || target === on) backingCodes.push(s.whType.toUpperCase());
    }
    const best = backingCodes.find(t => t !== 'K162') ?? backingCodes[0];

    if (best) {
      // A sig backs this connection — fill if empty, upgrade K162 → real code.
      if (conn.type === null) {
        updateConnection(conn.id, { type: best });
      } else if (conn.type.toUpperCase() === 'K162' && best !== 'K162') {
        updateConnection(conn.id, { type: best });
      }
      // else: '' (user cleared) or already a real code — leave it.
      continue;
    }

    // No sig backs the connection. If the old sig USED to back it and
    // conn.type still matches what the old sig had, treat as orphaned
    // auto-fill and clear.
    const oldType  = oldSig?.whType?.toUpperCase();
    const oldLeads = oldSig?.whLeadsTo?.toUpperCase();
    if (
      oldType && oldLeads &&
      (oldLeads === oc || oldLeads === on) &&
      conn.type && conn.type.toUpperCase() === oldType
    ) {
      updateConnection(conn.id, { type: null });
    }
  }
}
