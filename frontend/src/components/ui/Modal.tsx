import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  showClose?: boolean;
  bodyStyle?: React.CSSProperties;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  closeOnOverlay = true,
  closeOnEsc = true,
  showClose = true,
  bodyStyle,
  className,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const content = (
    <div
      ref={overlayRef}
      className="smc-modal-overlay"
      onClick={(e) => {
        if (closeOnOverlay && e.target === overlayRef.current) onClose();
      }}
    >
      <div className={`smc-modal ${className || ''}`} style={{ width }}>
        {(title || showClose) && (
          <div className="smc-modal__header">
            <div className="smc-modal__title">{title}</div>
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
        <div className="smc-modal__body" style={bodyStyle}>
          {children}
        </div>
        {footer && <div className="smc-modal__footer">{footer}</div>}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default Modal;
