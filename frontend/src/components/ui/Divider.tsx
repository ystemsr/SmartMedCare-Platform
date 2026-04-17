import React from 'react';

export interface DividerProps {
  vertical?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const Divider: React.FC<DividerProps> = ({ vertical, style, className }) =>
  vertical ? (
    <span className={['smc-divider--vertical', className || ''].join(' ')} style={style} />
  ) : (
    <hr className={['smc-divider', className || ''].join(' ')} style={style} />
  );

export default Divider;
