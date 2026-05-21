import { useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useStats, type StatPeriod, type SigBreakdown } from '../../hooks/useStats';

const PERIODS: { key: StatPeriod; label: string }[] = [
  { key: 'day',     label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'year',    label: 'This Year' },
  { key: 'forever', label: 'All Time' },
];

const SIG_ROWS: { key: keyof SigBreakdown; label: string }[] = [
  { key: 'wormhole', label: 'Wormhole' },
  { key: 'data',     label: 'Data' },
  { key: 'relic',    label: 'Relic' },
  { key: 'gas',      label: 'Gas' },
  { key: 'ore',      label: 'Ore' },
  { key: 'combat',   label: 'Combat' },
];

interface Props { onClose: () => void; }

export function UserStatsModal({ onClose }: Props) {
  const [period, setPeriod] = useState<StatPeriod>('day');
  const { stats, loading, error } = useStats(true);

  const current = stats?.[period];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal stats-modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal__header">
          <h2 className="modal__title">User Stats</h2>
          <button className="modal__close" onClick={onClose}><XIcon size={14} weight="bold" /></button>
        </div>

        <div className="stats-modal__periods">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              className={`stats-modal__period-btn${period === p.key ? ' stats-modal__period-btn--active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="modal__body">
          {loading && <div className="stats-modal__loading">Loading…</div>}
          {error   && <div className="stats-modal__error">{error}</div>}

          {current && (
            <>
              <div className="stats-modal__summary">
                <div className="stats-modal__card">
                  <span className="stats-modal__card-value">{current.jumps.toLocaleString()}</span>
                  <span className="stats-modal__card-label">Jumps</span>
                </div>
                <div className="stats-modal__card">
                  <span className="stats-modal__card-value">{current.signatures.total.toLocaleString()}</span>
                  <span className="stats-modal__card-label">Signatures</span>
                </div>
              </div>

              <h3 className="stats-modal__section-title">Signatures by type</h3>
              <table className="stats-modal__table">
                <thead>
                  <tr className="stats-modal__head-row">
                    <th className="stats-modal__th stats-modal__th--type">Type</th>
                    <th className="stats-modal__th stats-modal__th--count">Count</th>
                    <th className="stats-modal__th stats-modal__th--pct">%</th>
                    <th className="stats-modal__th stats-modal__th--bar" />
                  </tr>
                </thead>
                <tbody>
                  {SIG_ROWS.map((r) => {
                    const count = current.signatures[r.key];
                    const pct   = current.signatures.total > 0
                      ? Math.round((count / current.signatures.total) * 100)
                      : 0;
                    return (
                      <tr key={r.key} className="stats-modal__row">
                        <td className="stats-modal__row-label">{r.label}</td>
                        <td className="stats-modal__row-value">{count.toLocaleString()}</td>
                        <td className="stats-modal__row-pct">{pct}%</td>
                        <td className="stats-modal__row-bar">
                          <div className="stats-modal__bar-track">
                            <div className="stats-modal__bar" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
