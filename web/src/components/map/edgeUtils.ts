import type { InternalNode } from '@xyflow/react';
import { Position } from '@xyflow/react';
import type { XYPosition } from '@xyflow/react';

function getNodeIntersection(intersectionNode: InternalNode, targetNode: InternalNode): XYPosition {
  const { width: w = 0, height: h = 0 } = intersectionNode.measured ?? {};
  const hw = w / 2;
  const hh = h / 2;

  const x2 = intersectionNode.internals.positionAbsolute.x + hw;
  const y2 = intersectionNode.internals.positionAbsolute.y + hh;
  const x1 = targetNode.internals.positionAbsolute.x + hw;
  const y1 = targetNode.internals.positionAbsolute.y + hh;

  const xx1 = (x1 - x2) / (2 * hw) - (y1 - y2) / (2 * hh);
  const yy1 = (x1 - x2) / (2 * hw) + (y1 - y2) / (2 * hh);
  const a   = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return {
    x: hw * (xx3 + yy3) + x2,
    y: hh * (-xx3 + yy3) + y2,
  };
}

function getEdgePosition(node: InternalNode, point: XYPosition): Position {
  const nx = Math.round(node.internals.positionAbsolute.x);
  const ny = Math.round(node.internals.positionAbsolute.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);
  const w  = node.measured?.width  ?? 0;
  const h  = node.measured?.height ?? 0;

  if (px <= nx + 1)         return Position.Left;
  if (px >= nx + w - 1)     return Position.Right;
  if (py <= ny + 1)         return Position.Top;
  if (py >= ny + h - 1)     return Position.Bottom;
  return Position.Top;
}

export function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sp = getNodeIntersection(source, target);
  const tp = getNodeIntersection(target, source);
  return {
    sx: sp.x, sy: sp.y, sourcePos: getEdgePosition(source, sp),
    tx: tp.x, ty: tp.y, targetPos: getEdgePosition(target, tp),
  };
}
