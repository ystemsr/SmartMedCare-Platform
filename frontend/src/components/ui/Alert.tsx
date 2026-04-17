import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type AlertSeverity = 'success' | 'info' | 'warning' | 'error';

export interface AlertProps {
  severity?: AlertSeverity;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  variant?: 'standard' | 'filled';
  className?: string;
  style?: React.CSSProperties;
}

const iconMap: Record<AlertSeverity, React.ReactElement> = {
  success: <CheckCircle2 size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
  error: <XCircle size={18} />,
};

const Alert: React.FC<AlertProps> = ({
  severity = 'info',
  title,
  children,
  onClose,
  variant = 'standard',
  className,
  style,
}) => {
  const palette: Record<AlertSeverity, { bg: string; border: string; color: string }> = {
    success: {
      bg: 'var(--smc-success-50)',
      border: 'var(--smc-success)',
      color: 'var(--smc-success)',
    },
    info: { bg: 'var(--smc-info-50)', border: 'var(--smc-info)', color: 'var(--smc-info)' },
    warning: {
      bg: 'var(--smc-warning-50)',
      border: 'var(--smc-warning)',
      color: 'var(--smc-warning)',
    },
    error: { bg: 'var(--smc-error-50)', border: 'var(--smc-error)', color: 'var(--smc-error)' },
  };
  const tone = palette[severity];
  const baseStyle: React.CSSProperties =
    variant === 'filled'
      ? { background: tone.color, color: '#fff' }
      : { background: tone.bg, color: 'var(--smc-text)', borderLeft: `3px solid ${tone.color}` };

  return (
    <div
      role="alert"
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 'var(--smc-r-md)',
        ...baseStyle,
        ...style,
      }}
    >
      <span style={{ color: variant === 'filled' ? '#fff' : tone.color, display: 'inline-flex', marginTop: 2 }}>
        {iconMap[severity]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children && (
          <div style={{ fontSize: 'var(--smc-fs-sm)', color: variant === 'filled' ? '#fff' : 'var(--smc-text-2)' }}>
            {children}
          </div>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'currentColor',
            opacity: 0.8,
            padding: 0,
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Alert;
