import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { subscribeMessage } from '../../utils/message';

interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  content: string;
  duration: number;
}

const iconMap = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info: <Info size={18} />,
};

/**
 * Subscribes to the global `message` event bus and renders toast stack.
 * Replaces the previous MUI Snackbar-based ToastProvider with a pure custom
 * implementation — flat, smooth animations, no dependencies.
 */
const ToastViewport: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeMessage((event) => {
      setItems((prev) => [...prev, event]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== event.id));
      }, event.duration || 3000);
    });
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return ReactDOM.createPortal(
    <div className="smc-toast-layer" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`smc-toast smc-toast--${item.type}`}>
          <span style={{ display: 'inline-flex', flexShrink: 0 }}>{iconMap[item.type]}</span>
          <span style={{ flex: 1, minWidth: 0 }}>{item.content}</span>
          <button
            type="button"
            className="smc-toast__close"
            onClick={() => dismiss(item.id)}
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default ToastViewport;
