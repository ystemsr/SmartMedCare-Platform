import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

export interface StatusSwitcherProps {
  current: string;
  // 2x2 grid layout: [[topLeft, topRight], [bottomLeft, bottomRight]]
  grid: [[StatusOption, StatusOption], [StatusOption, StatusOption]];
  // Values the current status is allowed to transition to.
  // Any status outside this list is rendered disabled.
  allowedNext: string[];
  onChange: (next: string) => void;
  disabled?: boolean;
}

const POP_ENTER_MS = 200;
const POP_EXIT_MS = 160;

const StatusSwitcher: React.FC<StatusSwitcherProps> = ({
  current,
  grid,
  allowedNext,
  onChange,
  disabled,
}) => {
  // open: panel is mounted; closing: running the exit animation before unmount.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentOption =
    grid.flat().find((o) => o.value === current) ?? {
      value: current,
      label: current,
      color: 'var(--smc-text-3)',
    };

  const openPanel = () => {
    if (exitTimer.current) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const panelW = 220;
    let left = rect.left + window.scrollX;
    if (left + panelW > window.innerWidth - 8) {
      left = window.innerWidth - panelW - 8;
    }
    setCoords({ top: rect.bottom + 6 + window.scrollY, left: Math.max(8, left) });
    setMounted(true);
    // Next frame, flip visible=true to trigger enter transition.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  };

  const closePanel = () => {
    if (!mounted) return;
    setVisible(false);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      setMounted(false);
      exitTimer.current = null;
    }, POP_EXIT_MS);
  };

  useEffect(() => {
    if (!mounted) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closePanel();
    };
    const onScroll = () => closePanel();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  const handleSelect = (option: StatusOption) => {
    if (option.value === current) {
      closePanel();
      return;
    }
    if (!allowedNext.includes(option.value)) return;
    closePanel();
    onChange(option.value);
  };

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: coords?.top,
    left: coords?.left,
    width: 220,
    background: '#fff',
    border: '1px solid var(--smc-border)',
    borderRadius: 14,
    boxShadow:
      '0 12px 32px -12px rgba(24, 20, 16, 0.18), 0 2px 6px -2px rgba(24, 20, 16, 0.08)',
    padding: 10,
    zIndex: 1600,
    transformOrigin: 'top left',
    transition: visible
      ? `opacity ${POP_ENTER_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1), transform ${POP_ENTER_MS}ms cubic-bezier(0.22, 1.2, 0.36, 1)`
      : `opacity ${POP_EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1), transform ${POP_EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)`,
    opacity: visible ? 1 : 0,
    transform: visible
      ? 'scale(1) translateY(0)'
      : 'scale(0.9) translateY(-6px)',
    willChange: 'opacity, transform',
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (mounted) {
            closePanel();
          } else {
            openPanel();
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          height: 24,
          fontSize: 12,
          fontFamily: 'var(--smc-font-ui)',
          background: 'transparent',
          color: currentOption.color,
          border: `1px solid ${currentOption.color}`,
          borderRadius: 'var(--smc-r-full, 999px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'background var(--smc-dur-fast) var(--smc-ease)',
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--smc-surface-alt, rgba(0,0,0,0.03))';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <span>{currentOption.label}</span>
        <ChevronDown
          size={12}
          style={{
            transition: 'transform 180ms var(--smc-ease)',
            transform: visible ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {mounted && coords &&
        ReactDOM.createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {grid.flat().map((option) => {
                const isCurrent = option.value === current;
                const clickable =
                  !isCurrent && allowedNext.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!clickable}
                    onClick={() => handleSelect(option)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 8px',
                      fontSize: 12,
                      fontFamily: 'var(--smc-font-ui)',
                      fontWeight: 500,
                      background: isCurrent
                        ? `${option.color}1a`
                        : 'transparent',
                      color:
                        clickable || isCurrent
                          ? option.color
                          : 'var(--smc-text-3)',
                      border: `1px solid ${
                        isCurrent ? option.color : 'var(--smc-divider)'
                      }`,
                      borderRadius: 10,
                      cursor: clickable ? 'pointer' : 'not-allowed',
                      opacity: clickable || isCurrent ? 1 : 0.4,
                      transition:
                        'background 160ms var(--smc-ease), transform 160ms var(--smc-ease), border-color 160ms var(--smc-ease)',
                    }}
                    onMouseEnter={(e) => {
                      if (clickable) {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.background = `${option.color}1a`;
                        el.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = isCurrent
                        ? `${option.color}1a`
                        : 'transparent';
                      el.style.transform = 'translateY(0)';
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: option.color,
                      }}
                    />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

export default StatusSwitcher;
