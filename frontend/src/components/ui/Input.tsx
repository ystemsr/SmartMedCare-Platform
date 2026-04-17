import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    required,
    fullWidth = true,
    size = 'md',
    startAdornment,
    endAdornment,
    className,
    containerClassName,
    id,
    ...rest
  },
  ref,
) {
  const inputId = id || React.useId();
  const hasError = Boolean(error);
  const inputClasses = [
    'smc-input',
    size === 'lg' && 'smc-input--lg',
    hasError && 'smc-input--invalid',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputNode = (
    <input
      ref={ref}
      id={inputId}
      className={inputClasses}
      aria-invalid={hasError || undefined}
      {...rest}
    />
  );

  return (
    <div className={`smc-field ${containerClassName || ''}`} style={fullWidth ? undefined : { width: 'auto' }}>
      {label && (
        <label
          className={`smc-field__label ${required ? 'smc-field__label--required' : ''}`}
          htmlFor={inputId}
        >
          {label}
        </label>
      )}
      {startAdornment || endAdornment ? (
        <div className="smc-input-group">
          {startAdornment && <span className="smc-input-group__addon" style={{ left: 10, right: 'auto' }}>{startAdornment}</span>}
          {inputNode}
          {endAdornment && <span className="smc-input-group__addon">{endAdornment}</span>}
        </div>
      ) : (
        inputNode
      )}
      {(error || helperText) && (
        <div className="smc-field__error" style={!hasError ? { color: 'var(--smc-text-3)' } : undefined}>
          {error || helperText}
        </div>
      )}
    </div>
  );
});

export default Input;
