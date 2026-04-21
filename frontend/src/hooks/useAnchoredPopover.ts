import { useEffect, useState } from 'react';

export interface AnchoredRect {
  top: number;
  left: number;
  width: number;
  /** Whether the popover should be flipped above the anchor (preferred direction is below). */
  flipUp: boolean;
  /** Vertical space available in the chosen direction, in pixels (minus a small margin). */
  maxHeight: number;
}

const VIEWPORT_MARGIN = 12;
const GAP = 6;

/**
 * Track a trigger element's viewport rect so a fixed-position popover rendered
 * in a portal can stay anchored to it. Returns null while closed; otherwise
 * returns the latest anchored geometry and auto-flips upward when there isn't
 * enough room below.
 */
export function useAnchoredPopover(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement>,
  desiredHeight = 320,
): AnchoredRect | null {
  const [rect, setRect] = useState<AnchoredRect | null>(null);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }

    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - VIEWPORT_MARGIN;
      const spaceAbove = r.top - VIEWPORT_MARGIN;
      const flipUp = spaceBelow < Math.min(desiredHeight, 220) && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, flipUp ? spaceAbove - GAP : spaceBelow - GAP);
      setRect({
        top: flipUp ? Math.max(VIEWPORT_MARGIN, r.top - GAP) : r.bottom + GAP,
        left: r.left,
        width: r.width,
        flipUp,
        maxHeight,
      });
    };

    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, triggerRef, desiredHeight]);

  return rect;
}
