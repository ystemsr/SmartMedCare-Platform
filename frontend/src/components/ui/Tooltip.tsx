import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export interface TooltipProps {
  title?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  title,
  placement = 'top',
  children,
  delay = 120,
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePosition = () => {
    if (!wrapRef.current) return;
    const anchor = wrapRef.current.getBoundingClientRect();
    const bubble = bubbleRef.current?.getBoundingClientRect();
    const bw = bubble?.width ?? 0;
    const bh = bubble?.height ?? 0;
    let top = 0;
    let left = 0;
    switch (placement) {
      case 'top':
        top = anchor.top - bh - 6;
        left = anchor.left + anchor.width / 2 - bw / 2;
        break;
      case 'bottom':
        top = anchor.bottom + 6;
        left = anchor.left + anchor.width / 2 - bw / 2;
        break;
      case 'left':
        top = anchor.top + anchor.height / 2 - bh / 2;
        left = anchor.left - bw - 6;
        break;
      case 'right':
        top = anchor.top + anchor.height / 2 - bh / 2;
        left = anchor.right + 6;
        break;
    }
    setCoords({
      top: top + window.scrollY,
      left: left + window.scrollX,
    });
  };

  const show = () => {
    if (!title) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(true);
      // Measure after mount; first tick may miss bubble size, so recompute next frame.
      requestAnimationFrame(() => computePosition());
    }, delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    computePosition();
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <span
        ref={wrapRef}
        className="smc-tip-wrap"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open && title &&
        ReactDOM.createPortal(
          <span
            ref={bubbleRef}
            className="smc-tip-bubble smc-tip-bubble--portal"
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
            }}
          >
            {title}
          </span>,
          document.body,
        )}
    </>
  );
};

export default Tooltip;
