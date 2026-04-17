import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outlined' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Danger color modifier — works with outlined/text variants */
  danger?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    startIcon,
    endIcon,
    fullWidth,
    danger,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = [
    'smc-btn',
    `smc-btn--${variant}`,
    size !== 'md' && `smc-btn--${size}`,
    fullWidth && 'smc-btn--block',
    danger && variant !== 'primary' && variant !== 'secondary' && variant !== 'danger'
      ? 'smc-btn--danger'
      : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-disabled={disabled || loading ? 'true' : undefined}
      {...rest}
    >
      {loading ? <span className="smc-btn__spinner" aria-hidden /> : startIcon}
      {children}
      {endIcon}
    </button>
  );
});

export default Button;
