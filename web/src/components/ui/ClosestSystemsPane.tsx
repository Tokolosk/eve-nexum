import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapPinSimpleIcon, PathIcon, XIcon, PlusIcon, HouseIcon } from '@phosphor-icons/react';
import { useShallow } from 'zustand/react/shallow';
import { useCharacterLocation } from '../../hooks/useCharacterLocation';
import { useRoute, type RouteEntry } from '../../hooks/useRoute';
import { useEsiSearch } from '../../hooks/useEsiSearch';
import { useMapStore } from '../../store/mapStore';
import { setWaypoint, RouteSquares, KSPACE_CLASSES } from './routeUi';

// EVE system IDs for the major trade hubs. Used as the initial seed only —
// once the user has touched the list, theirs wins.
const DEFAULT_HUBS: ReadonlyArray<{ id: number; name: string }> = [
  { id: 30000142, name: 'Jita'    },
  { id: 30002187, name: 'Amarr'   },
  { id: 30002510, name: 'Rens'    },
  { id: 30002659, name: 'Dodixie' },
  { id: 30002053, name: 'Hek'     },
];

// Persist both the order AND the resolved names so the pane can label
// custom systems without making an extra round-trip on every reload.
const LIST_KEY = 'nexum.closestSystems.list';
// IDs the user has explicitly hidden when they were the current home.
// Lets someone keep their home set in-game without it cluttering this
// pane. If they later change home to a different system, the new home
// still auto-appears because its ID isn't in this set.
const HIDDEN_HOME_KEY = 'nexum.closestSystems.hiddenHome';

interface StoredEntry { id: number; name: string }

function loadList(): StoredEntry[] {
  const raw = localStorage.getItem(LIST_KEY);
  if (!raw) return DEFAULT_HUBS.map((h) => ({ id: h.id, name: h.name }));
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_HUBS.map((h) => ({ id: h.id, name: h.name }));
    return parsed
      .filter((e): e is StoredEntry =>
        typeof e === 'object' && e !== null
          && typeof (e as StoredEntry).id === 'number'
          && typeof (e as StoredEntry).name === 'string')
      .map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return DEFAULT_HUBS.map((h) => ({ id: h.id, name: h.name }));
  }
}

function loadHiddenHome(): Set<number> {
  const raw = localStorage.getItem(HIDDEN_HOME_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n): n is number => typeof n === 'number'));
  } catch {
    return new Set();
  }
}

interface RowItem {
  id:     number;
  name:   string;
  isHome: boolean;
  // `true` when the row is in the user's saved list — removing it just
  // takes it out of the list. The home auto-row (not in list) is also
  // removable; its remove handler adds the system ID to hiddenHome so
  // it stays gone until the user picks a different home.
  inList: boolean;
}

interface RowProps {
  item:      RowItem;
  route?:    RouteEntry;
  isOpen:    boolean;
  onToggle:  () => void;
  onRemove?: () => void;
  routeMode: string;
}

function Row({ item, route, isOpen, onToggle, onRemove, routeMode }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(item.id) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} className="scout-row" style={style}>
      <div className="scout-row__sys">
        <button
          type="button"
          className="scout-row__drag"
          title="Drag to reorder"
          {...listeners}
          {...attributes}
        >
          ⠿
        </button>
        <span className="scout-row__name">{item.name}</span>
        {item.isHome && (
          <span className="scout-row__home" aria-label="Home" data-tooltip="Home">
            <HouseIcon size={14} weight="regular" color="#f0c040" />
          </span>
        )}
      </div>

      <div className="scout-row__actions">
        <span className="scout-row__jumps">
          {route ? `${route.jumps} jumps` : '— jumps'}
        </span>
        <button
          type="button"
          className="sys-btn scout-row__btn scout-row__btn--icon"
          onClick={() => setWaypoint(item.id, item.name, true)}
          aria-label="Set Destination"
          data-tooltip="Set Destination"
        >
          <MapPinSimpleIcon size={14} weight="regular" color="#3ddc84" />
        </button>
        <button
          type="button"
          className="sys-btn scout-row__btn scout-row__btn--icon"
          onClick={() => setWaypoint(item.id, item.name, false)}
          aria-label="Add Waypoint"
          data-tooltip="Add Waypoint"
        >
          <PathIcon size={14} weight="regular" color="#5a9af8" />
        </button>
        {route && (
          <button
            type="button"
            className="sys-btn scout-row__btn"
            onClick={onToggle}
            aria-expanded={isOpen}
          >
            {isOpen ? `Hide ${routeMode} route` : `Show ${routeMode} route`}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            className="sys-btn scout-row__btn scout-row__btn--icon"
            onClick={onRemove}
            aria-label="Remove from list"
            data-tooltip="Remove from list"
          >
            <XIcon size={14} weight="regular" color="#e25a5a" />
          </button>
        )}
      </div>

      {route && isOpen && <RouteSquares route={route} />}
    </div>
  );
}

export function ClosestSystemsPane() {
  const location  = useCharacterLocation();
  const routeMode = useMapStore((s) => s.routeMode);
  const homeSystem = useMapStore(useShallow((s) => {
    const found = s.map.systems.find((sys) => sys.isHome && sys.eveSystemId != null);
    return found ? { id: found.eveSystemId as number, name: found.name } : null;
  }));

  const [list, setList]         = useState<StoredEntry[]>(loadList);
  const [hiddenHome, setHiddenHome] = useState<Set<number>>(loadHiddenHome);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [adding, setAdding]     = useState(false);
  const [query, setQuery]       = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const { results, loading }    = useEsiSearch(query);
  const inputRef                = useRef<HTMLInputElement>(null);
  const addRowRef               = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(LIST_KEY, JSON.stringify(list)); }, [list]);
  useEffect(() => { localStorage.setItem(HIDDEN_HOME_KEY, JSON.stringify([...hiddenHome])); }, [hiddenHome]);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);
  useEffect(() => { setActiveIndex(-1); }, [results]);

  // Recompute the portal position any time the search row or results
  // shift. The portal lives on document.body so it escapes the info
  // card's overflow: hidden (which clips inline-positioned dropdowns).
  useEffect(() => {
    if (!adding) { setDropdownPos(null); return; }
    function update() {
      const el = addRowRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [adding, results, query]);

  const canRoute =
    location.online &&
    location.system !== null &&
    KSPACE_CLASSES.has(location.system.systemClass);

  // Items = home (auto, if present and not in list and not hidden) ++
  // user list. Every row is removable. Removing the auto-home row hides
  // it via the hiddenHome set; if the user later picks a different
  // home, that new ID isn't in the set so it auto-appears.
  const items = useMemo<RowItem[]>(() => {
    const result: RowItem[] = [];
    const seen = new Set<number>();
    for (const entry of list) {
      const isHome = homeSystem?.id === entry.id;
      result.push({ id: entry.id, name: entry.name, isHome, inList: true });
      seen.add(entry.id);
    }
    if (homeSystem && !seen.has(homeSystem.id) && !hiddenHome.has(homeSystem.id)) {
      result.unshift({ id: homeSystem.id, name: homeSystem.name, isHome: true, inList: false });
    }
    return result;
  }, [list, homeSystem, hiddenHome]);

  const targetIds = useMemo(() => items.map((i) => i.id), [items]);
  const routes    = useRoute(canRoute ? location.system!.eveSystemId : null, targetIds);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Reorder only within the user list — the home auto-row (when not in
    // list) sits at the top regardless.
    const draggable = items.filter((i) => i.inList);
    const ids = draggable.map((i) => i.id);
    const a   = ids.indexOf(Number(active.id));
    const b   = ids.indexOf(Number(over.id));
    if (a < 0 || b < 0) return;
    const newOrder = arrayMove(ids, a, b);
    setList(newOrder.map((id) => list.find((e) => e.id === id)!).filter(Boolean));
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  function removeRow(id: number) {
    setList((prev) => prev.filter((e) => e.id !== id));
    // If we just removed the current home (whether it was in the list
    // or was the auto-row), hide it so it doesn't re-appear on the
    // next render. Tracking by ID means a future home change still
    // surfaces normally.
    if (homeSystem?.id === id) {
      setHiddenHome((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  }

  function addSystem(id: number, name: string) {
    setList((prev) => prev.some((e) => e.id === id) ? prev : [...prev, { id, name }]);
    // Adding a system explicitly clears the hidden-home flag for it —
    // user wants it back in the list now.
    if (hiddenHome.has(id)) {
      setHiddenHome((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    setQuery('');
    setAdding(false);
  }

  if (!canRoute) {
    return (
      <div className="scout-pane__empty">
        Sign in and dock in K-space to see jumps to hubs.
      </div>
    );
  }

  // Show already-added systems greyed out rather than hiding them — the
  // user can see "yes I already have Jita" instead of wondering why it
  // doesn't appear.
  const existingIds = new Set(items.map((i) => i.id));
  const showResults = adding && query.trim().length >= 2;
  const showEmpty   = showResults && results.length === 0 && !loading;

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setAdding(false); setQuery(''); setActiveIndex(-1);
      return;
    }
    if (!showResults || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => {
        // Skip past already-added entries
        let next = Math.min(i + 1, results.length - 1);
        while (next < results.length && existingIds.has(results[next].id)) next++;
        return next >= results.length ? i : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => {
        let next = Math.max(i - 1, 0);
        while (next >= 0 && existingIds.has(results[next].id)) next--;
        return next < 0 ? i : next;
      });
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const r = results[activeIndex];
      if (r && !existingIds.has(r.id)) addSystem(r.id, r.name);
    }
  }

  return (
    <div className="scout-pane">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => String(i.id))} strategy={verticalListSortingStrategy}>
          {items.map((i) => (
            <Row
              key={i.id}
              item={i}
              route={routes[String(i.id)]}
              isOpen={expanded.has(i.id)}
              onToggle={() => toggleExpanded(i.id)}
              onRemove={() => removeRow(i.id)}
              routeMode={routeMode}
            />
          ))}
        </SortableContext>
      </DndContext>

      {!adding ? (
        <button
          type="button"
          className="sys-btn scout-pane__add"
          onClick={() => setAdding(true)}
        >
          <PlusIcon size={14} weight="bold" /> Add System
        </button>
      ) : (
        <div className="scout-pane__add-row" ref={addRowRef}>
          <input
            ref={inputRef}
            className="scout-pane__add-input"
            type="text"
            placeholder="Search system name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleAddKeyDown}
            spellCheck={false}
          />
          <button
            type="button"
            className="sys-btn scout-row__btn scout-row__btn--icon"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setAdding(false); setQuery(''); }}
            aria-label="Cancel"
            data-tooltip="Cancel"
          >
            <XIcon size={14} weight="regular" color="#e25a5a" />
          </button>
        </div>
      )}

      {adding && dropdownPos && showResults && results.length > 0 && createPortal(
        <ul
          className="scout-pane__add-results"
          role="listbox"
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          {results.slice(0, 10).map((r, i) => {
            const already = existingIds.has(r.id);
            const cls =
              'scout-pane__add-result' +
              (i === activeIndex && !already ? ' scout-pane__add-result--active' : '') +
              (already ? ' scout-pane__add-result--disabled' : '');
            return (
              <li
                key={r.id}
                className={cls}
                role="option"
                aria-selected={i === activeIndex}
                aria-disabled={already}
                onMouseEnter={() => !already && setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); if (!already) addSystem(r.id, r.name); }}
              >
                <span className="scout-pane__add-result-name">{r.name}</span>
                <span className="scout-pane__add-result-region">
                  {already ? 'on list' : (r.regionName ?? r.systemClass)}
                </span>
              </li>
            );
          })}
        </ul>,
        document.body,
      )}

      {adding && dropdownPos && showEmpty && createPortal(
        <div
          className="scout-pane__add-empty"
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          No systems match "{query}"
        </div>,
        document.body,
      )}
    </div>
  );
}
