import { useEffect, useMemo, useRef, useState } from 'react';
import { CLASS_COLORS, CLASS_LABELS, WH_GROUPS, WORMHOLE_DESTINATIONS } from '../../data/wormholes';

interface Props {
  value: string;
  onChange: (whType: string, leadsTo: string) => void;
  statics?: string[];
}

interface DropdownPos { top: number; left: number; }

function DestBadge({ code }: { code: string }) {
  const dest = WORMHOLE_DESTINATIONS[code];
  if (!dest) return null;
  return (
    <>
      <span className="wh-picker__arrow">→</span>
      <span className="wh-picker__dest" style={{ color: CLASS_COLORS[dest] }}>
        {CLASS_LABELS[dest] ?? dest}
      </span>
    </>
  );
}

export function WormholeTypePicker({ value, onChange, statics = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left });
    setSearch('');
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btnRef.current?.contains(target) && !(document.getElementById('wh-picker-dropdown')?.contains(target))) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const select = (code: string) => {
    const leadsTo = code === 'K162' ? '' : (WORMHOLE_DESTINATIONS[code] ?? '');
    onChange(code, leadsTo);
    setOpen(false);
  };

  const q = search.trim().toUpperCase();

  const groups = useMemo(() => {
    const result: { key: string; label: string; types: string[]; totalCount: number }[] = [];
    if (statics.length > 0 && !q) {
      result.push({ key: '__statics', label: 'System Statics', types: statics, totalCount: statics.length });
    }
    for (const group of WH_GROUPS) {
      const filtered = q ? group.types.filter(t => t.includes(q)) : group.types;
      if (filtered.length > 0) {
        result.push({ key: group.key, label: group.label, types: filtered, totalCount: group.types.length });
      }
    }
    return result;
  }, [statics, q]);

  return (
    <div className="wh-picker">
      <button
        ref={btnRef}
        type="button"
        className={`wh-picker__btn${open ? ' wh-picker__btn--open' : ''}${!value ? ' wh-picker__btn--empty' : ''}`}
        onClick={openPicker}
      >
        {value ? (
          <span className="wh-picker__btn-inner">
            <span className="wh-picker__code">{value}</span>
            <DestBadge code={value} />
          </span>
        ) : (
          <span className="wh-picker__placeholder">Unknown</span>
        )}
        <span className="wh-picker__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          id="wh-picker-dropdown"
          className="wh-picker__dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
        >
          <input
            ref={searchRef}
            className="wh-picker__search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            spellCheck={false}
          />
          <div className="wh-picker__list">
            <div
              className={`wh-picker__option${!value ? ' wh-picker__option--active' : ''}`}
              onMouseDown={() => { onChange('', ''); setOpen(false); }}
            >
              <span className="wh-picker__placeholder">Unknown</span>
            </div>
            {groups.map(group => (
              <div key={group.key}>
                <div className="wh-picker__group-hdr">
                  {group.label}
                  <span className="wh-picker__group-count">({group.totalCount})</span>
                </div>
                {group.types.map(code => (
                  <div
                    key={code}
                    className={`wh-picker__option${value === code ? ' wh-picker__option--active' : ''}`}
                    onMouseDown={() => select(code)}
                  >
                    <span className="wh-picker__code">{code}</span>
                    <DestBadge code={code} />
                    {code === 'K162' && (
                      <span className="wh-picker__inbound">inbound</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
