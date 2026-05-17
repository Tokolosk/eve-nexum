import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface HoverState { index: number; xPct: number; yPct: number; value: number }

interface HourlyPoint {
  hour:      number;
  jumps:     number;
  shipKills: number;
  podKills:  number;
  npcKills:  number;
}

const VB_W   = 300;
const VB_H   = 120;
const PAD    = { top: 10, right: 6, bottom: 22, left: 42 };
const IW     = VB_W - PAD.left - PAD.right;
const IH     = VB_H - PAD.top  - PAD.bottom;
const SLOTS  = 24; // always render a 24-slot x-axis

// Fixed x-axis tick positions (hours-ago, right-anchored)
const X_TICKS = [0, 4, 8, 12, 16, 20];

function MiniLineChart({ title, values, color }: {
  title:  string;
  values: number[];
  color:  string;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const n      = values.length;
  const maxVal = Math.max(...values, 1);
  const avg    = n > 0 ? values.reduce((s, v) => s + v, 0) / n : 0;

  // slot 0 = oldest (left), slot SLOTS-1 = current hour (right)
  // data is right-aligned: data point i maps to slot (SLOTS - n + i)
  const xOfSlot = (slot: number) => PAD.left + (slot / (SLOTS - 1)) * IW;
  const xOfIdx  = (i:    number) => xOfSlot(SLOTS - n + i);
  const yOf     = (v:    number) => PAD.top + IH - (v / maxVal) * IH;
  const slotOfIdx = (i: number) => SLOTS - n + i;

  const avgY   = n > 0 ? yOf(avg) : PAD.top + IH;
  const yTicks = [0, 1, 2, 3].map((t) => Math.round((maxVal / 3) * t));
  const polyline = values.map((v, i) => `${xOfIdx(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

  return (
    <div className="activity-chart">
      <div className="activity-chart__title">{title}</div>
      <div className="activity-chart__plot">
      <svg
        className="activity-chart__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid + Y labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yOf(v)} x2={PAD.left + IW} y2={yOf(v)}
              stroke="#1a2535" strokeWidth={0.5}
            />
            <text x={PAD.left - 3} y={yOf(v) + 3.5} textAnchor="end" fontSize={11} fill="#7a90a8">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </text>
          </g>
        ))}

        {/* Average line */}
        {n > 0 && (
          <line
            x1={PAD.left} y1={avgY} x2={PAD.left + IW} y2={avgY}
            stroke="#f0a030" strokeWidth={1} strokeDasharray="4 3" opacity={0.8}
          />
        )}

        {/* Current-hour marker (right edge) */}
        <line
          x1={xOfSlot(SLOTS - 1)} y1={PAD.top}
          x2={xOfSlot(SLOTS - 1)} y2={PAD.top + IH}
          stroke="#2e4060" strokeWidth={1} strokeDasharray="2 2"
        />

        {/* Data line */}
        {n > 1 && (
          <polyline points={polyline} fill="none" stroke={color} strokeWidth={1.5} />
        )}

        {/* Crosshair on the hovered point */}
        {hover && (
          <line
            x1={xOfIdx(hover.index)} y1={PAD.top}
            x2={xOfIdx(hover.index)} y2={PAD.top + IH}
            stroke={color} strokeWidth={0.8} opacity={0.4}
            pointerEvents="none"
          />
        )}

        {/* Visible dot + a larger transparent hit-target so 24 ticks are
            still easy to mouse onto. */}
        {values.map((v, i) => {
          const cx = xOfIdx(i);
          const cy = yOf(v);
          const isActive = hover?.index === i;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={isActive ? 3.4 : 2.2}
                fill={color} stroke="#08090f" strokeWidth={0.8}
                pointerEvents="none" />
              <circle cx={cx} cy={cy} r={8}
                fill="transparent"
                onMouseEnter={() => setHover({
                  index: i,
                  value: v,
                  xPct:  (cx / VB_W) * 100,
                  yPct:  (cy / VB_H) * 100,
                })}
              />
            </g>
          );
        })}

        {/* Fixed X-axis labels (right-anchored, hours-ago) */}
        {X_TICKS.map((hoursAgo) => {
          const slot = SLOTS - 1 - hoursAgo;
          return (
            <text key={hoursAgo} x={xOfSlot(slot)} y={VB_H - 4}
              textAnchor="middle" fontSize={11} fill="#7a90a8">
              {hoursAgo}h
            </text>
          );
        })}
      </svg>
      {hover && (
        <div
          className="activity-chart__tooltip"
          style={{
            left: `${hover.xPct}%`,
            top:  `${hover.yPct}%`,
          }}
        >
          <span className="activity-chart__tooltip-value">{hover.value.toLocaleString()}</span>
          <span className="activity-chart__tooltip-when">{hoursAgoLabel(SLOTS - 1 - slotOfIdx(hover.index))}</span>
        </div>
      )}
      </div>
    </div>
  );
}

function hoursAgoLabel(h: number): string {
  if (h <= 0) return 'this hour';
  if (h === 1) return '1h ago';
  return `${h}h ago`;
}

export function ActivityPane({ eveSystemId }: { eveSystemId: number | null }) {
  const [data, setData]       = useState<HourlyPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eveSystemId) return;
    setData([]);
    setLoading(true);

    const load = () =>
      api<HourlyPoint[]>(`/api/activity/${eveSystemId}`)
        .then(setData)
        .catch(() => {});

    load().finally(() => setLoading(false));

    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [eveSystemId]);

  if (!eveSystemId) return <div className="sig-pane__empty">No EVE system linked</div>;
  if (loading)      return <div className="sig-pane__empty">Loading activity…</div>;

  return (
    <div className="activity-pane">
      <MiniLineChart
        title="Jumps"
        values={data.map((p) => p.jumps)}
        color="#4dd9ac"
      />
      <MiniLineChart
        title="Ship / Pod Kills"
        values={data.map((p) => p.shipKills + p.podKills)}
        color="#e05a5a"
      />
      <MiniLineChart
        title="NPC Kills"
        values={data.map((p) => p.npcKills)}
        color="#5a9af8"
      />
    </div>
  );
}
