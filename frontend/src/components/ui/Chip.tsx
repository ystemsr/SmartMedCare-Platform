import React from 'react';

export type ChipTone = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  size?: 'sm' | 'md';
  outlined?: boolean;
  icon?: React.ReactNode;
}

const Chip: React.FC<ChipProps> = ({
  tone = 'default',
  size = 'sm',
  outlined,
  icon,
  className,
  children,
  ...rest
}) => {
  const classes = [
    'smc-chip',
    size === 'md' && 'smc-chip--lg',
    tone !== 'default' && `smc-chip--${tone}`,
    outlined && 'smc-chip--outlined',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...rest}>
      {icon}
      {children}
    </span>
  );
};

export default Chip;
