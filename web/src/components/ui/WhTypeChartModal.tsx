import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { CLASS_COLORS } from '../../data/wormholes';
import type { SystemClass } from '../../types';
import {
  WH_CHART, RESPAWN_ORDER, SPAWN_ORDER, LEADS_ORDER, SHIP_ORDER, MASS_ORDER, LIFE_ORDER,
  type WhChartEntry,
} from '../../data/whTypeChart';

// A Nexum take on whtype.info: pick a wormhole code and lines light up its
// spawn / leads-to / ship size / total mass / lifetime across the columns.

interface Line { d: string; color: string; }

// Map a spawn/leads label to a class colour where one exists, for the row text.
function labelColor(label: string): string | undefined {
  const m: Record<string, SystemClass> = {
    'Class 1': 'C1', 'Class 2': 'C2', 'Class 3': 'C3', 'Class 4': 'C4', 'Class 5': 'C5', 'Class 6': 'C6',
    'HighSec': 'HS', 'LowSec': 'LS', 'NullSec': 'NS', 'Class 12 - Thera': 'Thera', 'Class 13 - Shattered': 'C13',
    'Pochven ▲ Trig space': 'Pochven',
    C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4', C5: 'C5', C6: 'C6', HS: 'HS', LS: 'LS', NS: 'NS',
    Thera: 'Thera', C13: 'C13', Pochven: 'Pochven',
  };
  const key = m[label];
  return key ? CLASS_COLORS[key] : undefined;
}

// Colour for a whole code's line bundle — by its destination class so the eye
// can follow it. Drifter / special dests fall back to a neutral accent.
function lineColorFor(entry: WhChartEntry): string {
  return labelColor(entry.leads_to[0] ?? '') ?? '#5b9bff';
}

export function WhTypeChartModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const codeListRef = useRef<HTMLDivElement | null>(null);
  // key -> row element, for measuring line endpoints.
  const rows = useRef<Map<string, HTMLElement>>(new Map());
  const setRow = (key: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(key, el); else rows.current.delete(key);
  };

  const entry = useMemo(() => WH_CHART.find((w) => w.wormhole === active) ?? null, [active]);

  const codes = useMemo(() => {
    const q = search.trim().toUpperCase();
    return WH_CHART.filter((w) => !q || w.wormhole.toUpperCase().includes(q));
  }, [search]);

  // Which column rows the active code touches (for highlighting).
  const activeTargets = useMemo(() => {
    const s = new Set<string>();
    if (!entry) return s;
    entry.respawn.forEach((r) => s.add(`respawn:${r}`));
    entry.spawn_in.forEach((v) => s.add(`spawn:${v}`));
    entry.leads_to.forEach((v) => s.add(`leads:${v}`));
    if (entry.ship_size)  s.add(`ship:${entry.ship_size}`);
    if (entry.total_mass) s.add(`mass:${entry.total_mass}`);
    if (entry.life_time)  s.add(`life:${entry.life_time}`);
    return s;
  }, [entry]);

  const [lines, setLines] = useState<Line[]>([]);

  // Recompute the connecting lines whenever the active code changes (and when
  // the code list scrolls or the window resizes, so the source endpoint tracks
  // the hovered row).
  useLayoutEffect(() => {
    function recompute() {
      const body = bodyRef.current;
      const src = active ? rows.current.get(`code:${active}`) : null;
      if (!body || !src || !entry) { setLines([]); return; }
      const base = body.getBoundingClientRect();
      const rel = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - base.left, y: r.top - base.top + r.height / 2 };
      };
      const sr = src.getBoundingClientRect();
      // Clamp the source Y to the visible code-list band so a scrolled-away
      // code doesn't shoot a line off into space.
      const list = codeListRef.current?.getBoundingClientRect();
      let sy = sr.top - base.top + sr.height / 2;
      if (list) sy = Math.max(list.top - base.top, Math.min(list.bottom - base.top, sy));
      const sx = sr.right - base.left;
      const color = lineColorFor(entry);
      const out: Line[] = [];
      for (const key of activeTargets) {
        const el = rows.current.get(key);
        if (!el) continue;
        const { x: tx, y: ty } = rel(el);
        const dx = Math.max(40, (tx - sx) * 0.45);
        out.push({ d: `M ${sx},${sy} C ${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`, color });
      }
      setLines(out);
    }
    recompute();
    const list = codeListRef.current;
    list?.addEventListener('scroll', recompute);
    window.addEventListener('resize', recompute);
    return () => { list?.removeEventListener('scroll', recompute); window.removeEventListener('resize', recompute); };
  }, [active, entry, activeTargets]);

  const col = (
    title: string,
    keyPrefix: string,
    values: readonly string[],
    opts?: { colorize?: boolean; className?: string },
  ) => (
    <div className={`whchart__col ${opts?.className ?? ''}`}>
      <div className="whchart__col-head">{title}</div>
      {values.map((v) => {
        const key = `${keyPrefix}:${v}`;
        const on = activeTargets.has(key);
        const c = opts?.colorize ? labelColor(v) : undefined;
        return (
          <div
            key={key}
            ref={setRow(key)}
            className={`whchart__cell${on ? ' whchart__cell--on' : ''}`}
            style={on && c ? { color: c } : c && !on ? { color: c, opacity: 0.55 } : undefined}
          >
            {v}
          </div>
        );
      })}
    </div>
  );

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal whchart" role="dialog" aria-modal="true">
        <div className="modal__header">
          <h2 className="modal__title">{t('whChart.title')}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('actions.close')}>
            <XIcon size={16} weight="bold" />
          </button>
        </div>

        <div className="modal__body whchart__body" ref={bodyRef}>
          <svg className="whchart__lines" aria-hidden="true">
            {lines.map((l, i) => (
              <path key={i} d={l.d} fill="none" stroke={l.color} strokeWidth={1.5} opacity={0.85} />
            ))}
          </svg>

          {/* Codes */}
          <div className="whchart__col whchart__col--codes">
            <div className="whchart__col-head">
              {t('whChart.colWormholes')}
              <input
                className="whchart__search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('whChart.searchPlaceholder')}
                spellCheck={false}
              />
            </div>
            <div className="whchart__codes" ref={codeListRef}>
              {codes.map((w) => (
                <div
                  key={w.wormhole}
                  ref={setRow(`code:${w.wormhole}`)}
                  className={`whchart__code${active === w.wormhole ? ' whchart__code--active' : ''}`}
                  onMouseEnter={() => setActive(w.wormhole)}
                  onClick={() => setActive((cur) => (cur === w.wormhole ? null : w.wormhole))}
                >
                  {w.wormhole}
                </div>
              ))}
            </div>
          </div>

          {col(t('whChart.colRespawn'),  'respawn', RESPAWN_ORDER, { className: 'whchart__col--narrow' })}
          {col(t('whChart.colSpawnIn'),  'spawn',   SPAWN_ORDER,   { colorize: true })}
          {col(t('whChart.colLeadsTo'),  'leads',   LEADS_ORDER,   { colorize: true })}
          {col(t('whChart.colShipSize'), 'ship',    SHIP_ORDER)}
          {col(t('whChart.colTotalMass'),'mass',    MASS_ORDER)}
          {col(t('whChart.colLifetime'), 'life',    LIFE_ORDER, { className: 'whchart__col--narrow' })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
