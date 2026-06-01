import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hover tooltip that renders via portal to document.body so it escapes
 * any ancestor `overflow: hidden` / `overflow: auto` clipping that would
 * otherwise truncate the chip. Use this instead of `data-tooltip` when
 * the trigger lives inside a scroll container (System Panel left column,
 * sig pane, etc).
 *
 * Positioning is recomputed on each hover from the trigger's bounding
 * rect — no resize observer is needed because the tooltip is only visible
 * while the cursor is over the trigger, and triggers don't typically
 * reflow mid-hover. After the chip is laid out at its natural size it is
 * CLAMPED inside the viewport, so it can never spill off the display area
 * even when the trigger sits close to an edge.
 *
 * `placement` picks the preferred side the chip appears on:
 *   - 'right' = vertically centred on the trigger, to its right
 *   - 'above' = horizontally centred on the trigger, above it
 *   - 'below' = horizontally centred on the trigger, below it
 */
type Placement = 'right' | 'above' | 'below';

interface Props {
  label:      string;
  placement?: Placement;
  className?: string;
  children:   ReactNode;
}

const GAP = 8;
const MARGIN = 6;

export function Tooltip({ label, placement = 'right', className, children }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  // The trigger rect captured at hover time; positioning happens after the
  // chip mounts so we know its measured size and can clamp to the viewport.
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setPos(null); // hide until measured at the new size/position
    setRect(el.getBoundingClientRect());
  }, []);

  const hide = useCallback(() => { setRect(null); setPos(null); }, []);

  // Tear down the floating chip if the trigger unmounts while hovered
  // (e.g. system panel closes mid-hover).
  useEffect(() => () => { setRect(null); setPos(null); }, []);

  useLayoutEffect(() => {
    if (!rect || !chipRef.current) return;
    const tip = chipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;
    if (placement === 'right') {
      top = rect.top + rect.height / 2 - tip.height / 2;
      left = rect.right + GAP;
    } else if (placement === 'above') {
      top = rect.top - GAP - tip.height;
      left = rect.left + rect.width / 2 - tip.width / 2;
    } else {
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - tip.width / 2;
    }

    left = Math.max(MARGIN, Math.min(left, vw - tip.width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - tip.height - MARGIN));
    setPos({ top, left });
  }, [rect, placement]);

  return (
    <>
      <span
        ref={wrapRef}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {rect && createPortal(
        <span
          ref={chipRef}
          className="floating-tooltip"
          style={{
            top:        pos?.top ?? 0,
            left:       pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}
