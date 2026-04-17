import React, { useState } from 'react';

export interface TooltipProps {
  title?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactElement;
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({ title, placement = 'top', children, delay = 120 }) => {
  const [open, setOpen] = useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (!title) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };

  const pos: React.CSSProperties = {
    top: { bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' },
    bottom: { top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' },
    left: { right: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' },
    right: { left: 'calc(100% + 6px)', top: '50%', transform: 'translateY(-50%)' },
  }[placement];

  return (
    <span
      className="smc-tip-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && title && <span className="smc-tip-bubble" style={pos}>{title}</span>}
    </span>
  );
};

export default Tooltip;
