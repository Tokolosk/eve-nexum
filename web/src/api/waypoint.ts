import { api } from './client';

export function setDestination(destinationId: number) {
  return api('/api/character/waypoint', {
    method: 'POST',
    body: JSON.stringify({ destinationId, clearOtherWaypoints: true, addToBeginning: false }),
  });
}

export function addWaypoint(destinationId: number) {
  return api('/api/character/waypoint', {
    method: 'POST',
    body: JSON.stringify({ destinationId, clearOtherWaypoints: false, addToBeginning: false }),
  });
}
