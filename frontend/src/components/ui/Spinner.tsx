import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: React.ReactNode;
  style?: React.CSSProperties;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', label, style }) => {
  const cls = ['smc-spinner', size !== 'md' && `smc-spinner--${size}`].filter(Boolean).join(' ');
  if (label) {
    return (
      <div className="smc-loading-wrap" style={style}>
        <span className={cls} />
        <div>{label}</div>
      </div>
    );
  }
  return <span className={cls} style={style} />;
};

export default Spinner;
