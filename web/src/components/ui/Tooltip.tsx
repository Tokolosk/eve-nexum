import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
 * reflow mid-hover.
 *
 * `placement` picks the side the chip appears on:
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

export function Tooltip({ label, placement = 'right', className, children }: Props) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string } | null>(null);

  const show = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (placement === 'right') {
      setCoords({
        top:       r.top + r.height / 2,
        left:      r.right + GAP,
        transform: 'translateY(-50%)',
      });
    } else if (placement === 'above') {
      setCoords({
        top:       r.top - GAP,
        left:      r.left + r.width / 2,
        transform: 'translate(-50%, -100%)',
      });
    } else {
      setCoords({
        top:       r.bottom + GAP,
        left:      r.left + r.width / 2,
        transform: 'translateX(-50%)',
      });
    }
  }, [placement]);

  const hide = useCallback(() => setCoords(null), []);

  // Tear down the floating chip if the trigger unmounts while hovered
  // (e.g. system panel closes mid-hover).
  useEffect(() => () => setCoords(null), []);

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
      {coords && createPortal(
        <span
          className="floating-tooltip"
          style={{
            top:       coords.top,
            left:      coords.left,
            transform: coords.transform,
          }}
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  );
}
