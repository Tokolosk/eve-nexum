import { memo } from 'react';
import {
  getBezierPath, getStraightPath, getSmoothStepPath,
  EdgeLabelRenderer, BaseEdge,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import type { MapConnection } from '../../types';
import { useMapStore } from '../../store/mapStore';

const STANDARD_COLOR = '#8a9ab8';
const JUMPGATE_COLOR  = '#4db8c4';

const TIME_COLORS: Record<string, string> = {
  lessThan4h: '#f0c040',
  lessThan1h: '#ff9800',
  expired:    '#f44336',
};

const MASS_LABELS: Record<string, { text: string; cls: string }> = {
  stable:       { text: '> 50%', cls: 'connection-label__mass' },
  destabilized: { text: '< 50%', cls: 'connection-label__mass connection-label__mass--warn' },
  critical:     { text: '< 10%', cls: 'connection-label__mass connection-label__mass--crit' },
};

export const ConnectionEdge = memo(({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) => {
  const conn = data as unknown as MapConnection & { edgeStyle?: string };
  const selectConnection = useMapStore((s) => s.selectConnection);

  const [edgePath, labelX, labelY] = (() => {
    const args = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
    switch (conn?.edgeStyle) {
      case 'straight':     return getStraightPath({ sourceX, sourceY, targetX, targetY });
      case 'smoothstep':   return getSmoothStepPath(args);
      default:             return getBezierPath(args);
    }
  })();

  const isJumpgate  = conn?.connectionType === 'jumpgate';
  const timeStatus  = conn?.timeStatus ?? null;
  const color       = isJumpgate ? JUMPGATE_COLOR : (TIME_COLORS[timeStatus ?? ''] ?? STANDARD_COLOR);
  const strokeWidth = selected ? 6 : 4;
  const massLabel   = !isJumpgate && conn?.massStatus ? (MASS_LABELS[conn.massStatus] ?? null) : null;

  const timeLabel = (() => {
    switch (timeStatus) {
      case 'lessThan4h': return { text: '< 4 hrs', cls: 'connection-label__eol' };
      case 'lessThan1h': return { text: '< 1 hr',  cls: 'connection-label__eol' };
      case 'expired':    return { text: '!',        cls: 'connection-label__crit' };
      default:           return null;
    }
  })();

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: isJumpgate ? '10 5' : undefined,
          filter: selected ? `drop-shadow(0 0 6px ${color})` : undefined,
          opacity: selected ? 1 : 0.85,
        }}
        markerEnd={undefined}
      />
      <EdgeLabelRenderer>
        <div
          className="connection-label"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
          onClick={() => selectConnection(id)}
        >
          {isJumpgate && <span className="connection-label__jumpgate">JG</span>}
          {!isJumpgate && conn?.type && <span className="connection-label__type">{conn.type}</span>}
          {!isJumpgate && massLabel && <span className={massLabel.cls}>{massLabel.text}</span>}
          {timeLabel && <span className={timeLabel.cls}>{timeLabel.text}</span>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

ConnectionEdge.displayName = 'ConnectionEdge';
