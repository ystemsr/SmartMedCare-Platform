import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

export interface MenuItemDescriptor {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  divider?: boolean;
}

export interface MenuHeader {
  key: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  header: true;
}

export type MenuEntry = MenuItemDescriptor | MenuHeader;

export interface DropdownMenuProps {
  trigger: React.ReactElement;
  items: MenuEntry[];
  align?: 'start' | 'end';
  minWidth?: number;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'end',
  minWidth = 180,
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const left = align === 'end' ? rect.right - minWidth : rect.left;
    setCoords({ top: rect.bottom + 6 + window.scrollY, left: Math.max(8, left + window.scrollX) });
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const triggerElement = React.cloneElement(trigger, {
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e);
      updatePosition();
      setOpen((v) => !v);
    },
  });

  return (
    <>
      <span ref={anchorRef} style={{ display: 'inline-flex' }}>
        {triggerElement}
      </span>
      {open && coords &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="smc-menu"
            style={{ top: coords.top, left: coords.left, minWidth }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((entry) => {
              if ('header' in entry) {
                return (
                  <div key={entry.key} className="smc-menu__header">
                    <div className="smc-menu__header-title">{entry.title}</div>
                    {entry.subtitle && <div className="smc-menu__header-sub">{entry.subtitle}</div>}
                  </div>
                );
              }
              if (entry.divider) return <div key={entry.key} className="smc-menu__divider" />;
              return (
                <button
                  key={entry.key}
                  type="button"
                  disabled={entry.disabled}
                  className={['smc-menu__item', entry.danger && 'smc-menu__item--danger'].filter(Boolean).join(' ')}
                  onClick={() => {
                    entry.onSelect?.();
                    setOpen(false);
                  }}
                >
                  {entry.icon}
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
};

export default DropdownMenu;
