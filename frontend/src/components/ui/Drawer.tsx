import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  placement?: 'right' | 'left';
  width?: number | string;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlay?: boolean;
  showClose?: boolean;
}

const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  placement = 'right',
  width = 380,
  title,
  children,
  footer,
  closeOnOverlay = true,
  showClose = true,
}) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <>
      <div
        className="smc-drawer-overlay"
        onClick={() => closeOnOverlay && onClose()}
      />
      <aside
        className={`smc-drawer smc-drawer--${placement}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {(title || showClose) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--smc-divider)',
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 'var(--smc-fs-lg)' }}>{title}</div>
            {showClose && (
              <button
                type="button"
                className="smc-modal__close"
                aria-label="关闭"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>{children}</div>
        {footer && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              padding: '12px 20px',
              borderTop: '1px solid var(--smc-divider)',
            }}
          >
            {footer}
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
};

export default Drawer;
