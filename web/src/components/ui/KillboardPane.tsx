import { useState } from 'react';
import { useKillboard } from '../../hooks/useKillboard';
import type { ZkbKill } from '../../hooks/useKillboard';

const PAGE_SIZE = 5;

const EVE_IMG = 'https://images.evetech.net';
const ZKB     = 'https://zkillboard.com';

function formatIsk(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h > 0)   return `${h}h ${m}m ago`;
  return m <= 0 ? 'just now' : `${m}m ago`;
}

function ZkbLink({ href, tip, children }: { href: string; tip: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      data-tip={tip}
      target="_blank"
      rel="noreferrer"
      className="zkb-kill__icon-link"
    >
      {children}
    </a>
  );
}

function EntityCol({ characterId, corporationId, allianceId, label }: {
  characterId?:   number;
  corporationId?: number;
  allianceId?:    number;
  label:          string;
}) {
  return (
    <div className="zkb-kill__entity-col">
      {characterId ? (
        <ZkbLink href={`${ZKB}/character/${characterId}/`} tip={`${label} on zKillboard`}>
          <img className="zkb-kill__icon" src={`${EVE_IMG}/characters/${characterId}/portrait?size=32`} alt="" loading="lazy" />
        </ZkbLink>
      ) : corporationId ? (
        <ZkbLink href={`${ZKB}/corporation/${corporationId}/`} tip={`${label} corporation on zKillboard`}>
          <img className="zkb-kill__icon" src={`${EVE_IMG}/corporations/${corporationId}/logo?size=32`} alt="" loading="lazy" />
        </ZkbLink>
      ) : null}
      {corporationId && (
        <ZkbLink href={`${ZKB}/corporation/${corporationId}/`} tip="Corporation on zKillboard">
          <img className="zkb-kill__icon" src={`${EVE_IMG}/corporations/${corporationId}/logo?size=32`} alt="" loading="lazy" />
        </ZkbLink>
      )}
      {allianceId && (
        <ZkbLink href={`${ZKB}/alliance/${allianceId}/`} tip="Alliance on zKillboard">
          <img className="zkb-kill__icon" src={`${EVE_IMG}/alliances/${allianceId}/logo?size=32`} alt="" loading="lazy" />
        </ZkbLink>
      )}
    </div>
  );
}

function KillRow({ kill }: { kill: ZkbKill }) {
  const isPod      = kill.victim.ship_type_id === 670;
  const v          = kill.victim;
  const fbAttacker = kill.attackers.find((a) => a.final_blow);

  return (
    <div className={`zkb-kill${isPod ? ' zkb-kill--pod' : ''}`}>
      <a
        href={`${ZKB}/kill/${kill.killmail_id}/`}
        target="_blank"
        rel="noreferrer"
        data-tip="View killmail on zKillboard"
        className="zkb-kill__icon-link"
      >
        <img
          className="zkb-kill__ship"
          src={`${EVE_IMG}/types/${v.ship_type_id}/render?size=64`}
          alt=""
          loading="lazy"
        />
      </a>

      <div className="zkb-kill__info">
        <div className="zkb-kill__row1">
          <EntityCol
            characterId={v.character_id}
            corporationId={v.corporation_id}
            allianceId={v.alliance_id}
            label="Victim"
          />
          {kill.zkb.solo && (
            <span className="zkb-kill__badge zkb-kill__badge--solo">Solo</span>
          )}
          {!kill.zkb.solo && kill.attackers.length > 1 && (
            <span className="zkb-kill__badge">+{kill.attackers.length}</span>
          )}
        </div>
        <div className="zkb-kill__row2">
          <span className="zkb-kill__value">{formatIsk(kill.zkb.totalValue)} ISK</span>
        </div>
        <div className="zkb-kill__row3">
          <span className="zkb-kill__time">{timeAgo(kill.killmail_time)}</span>
        </div>
      </div>

      {fbAttacker && (
        <EntityCol
          characterId={fbAttacker.character_id}
          corporationId={fbAttacker.corporation_id}
          allianceId={fbAttacker.alliance_id}
          label="Final blow"
        />
      )}
    </div>
  );
}

interface Props {
  eveSystemId: number | null;
}

export function KillboardPane({ eveSystemId }: Props) {
  const { kills, loading, error, lastUpdated } = useKillboard(eveSystemId);
  const [page, setPage] = useState(0);

  if (!eveSystemId) {
    return <p className="zkb-state">No EVE system linked.</p>;
  }
  if (loading && kills.length === 0) {
    return <p className="zkb-state">Loading kills…</p>;
  }
  if (error) {
    return <p className="zkb-state zkb-state--error">{error}</p>;
  }
  if (kills.length === 0) {
    return <p className="zkb-state">No kills in the last 24h.</p>;
  }

  const totalPages = Math.ceil(kills.length / PAGE_SIZE);
  const safePage   = Math.min(page, totalPages - 1);
  const pageKills  = kills.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="zkb-pane">
      <div className="zkb-pane__meta">
        <span>
          {kills.length} kill{kills.length !== 1 ? 's' : ''}
          {lastUpdated && <> · updated {timeAgo(lastUpdated.toISOString())}</>}
        </span>
        {totalPages > 1 && (
          <span className="zkb-pane__pages">
            <button
              type="button"
              className="zkb-page-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >‹</button>
            <span className="zkb-pane__page-label">{safePage + 1} / {totalPages}</span>
            <button
              type="button"
              className="zkb-page-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage === totalPages - 1}
            >›</button>
          </span>
        )}
      </div>
      <div className="zkb-pane__list">
        {pageKills.map((k) => <KillRow key={k.killmail_id} kill={k} />)}
      </div>
    </div>
  );
}
