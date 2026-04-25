import { useEffect, useState } from 'react';

export interface AnchoredRect {
  left: number;
  width: number;
  /** Whether the popover is sitting above the trigger rather than below. */
  flipUp: boolean;
  /** Maximum height for the popover, clamped to the chosen side. */
  maxHeight: number;
  /**
   * CSS `top` for the popover (viewport-relative). Set to `'auto'` when
   * flipped up so the inline style overrides any cascaded `top` rule (e.g.
   * `.smc-select__popover` sets `top: calc(100% + 6px)` which would otherwise
   * push a fixed-positioned popover off-screen).
   */
  top: number | 'auto';
  /**
   * CSS `bottom` (distance from viewport bottom). Set to `'auto'` when the
   * popover is placed below the trigger, for the same override reason as
   * `top` above.
   */
  bottom: number | 'auto';
}

const VIEWPORT_MARGIN = 12;
const GAP = 6;

/**
 * Track a trigger element's viewport rect so a fixed-position popover rendered
 * in a portal can stay anchored to it. Returns null while closed; otherwise
 * returns viewport-relative geometry, flipping upward automatically when the
 * trigger sits in the lower half of the viewport so the popover always stays
 * on-screen regardless of browser zoom.
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

    let rafId: number | null = null;
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // If the trigger hasn't settled into a real box yet (e.g. the modal
      // animation is still in its first frame), retry next rAF instead of
      // pinning the popover to (0, 0) with zero width.
      if (r.width === 0 && r.height === 0) {
        rafId = window.requestAnimationFrame(compute);
        return;
      }
      const vh = window.innerHeight;
      const spaceBelow = vh - r.bottom - VIEWPORT_MARGIN;
      const spaceAbove = r.top - VIEWPORT_MARGIN;

      // Prefer the side with more room — no hard-coded threshold. Keeps the
      // popover on-screen regardless of browser zoom or modal scroll state.
      const flipUp = spaceAbove > spaceBelow;
      const available = flipUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(160, available - GAP);

      if (flipUp) {
        // Pin the popover's bottom just above the trigger. The element grows
        // upward to fit content, capped by `maxHeight`.
        setRect({
          top: 'auto',
          bottom: vh - (r.top - GAP),
          left: r.left,
          width: r.width,
          flipUp,
          maxHeight,
        });
      } else {
        setRect({
          top: r.bottom + GAP,
          bottom: 'auto',
          left: r.left,
          width: r.width,
          flipUp,
          maxHeight,
        });
      }
      // Only desiredHeight is used implicitly above — keep the param so the
      // caller can ask for a tighter available side if needed.
      void desiredHeight;
    };

    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, triggerRef, desiredHeight]);

  return rect;
}
