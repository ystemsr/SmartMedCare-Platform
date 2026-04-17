import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  required?: boolean;
  fullWidth?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, helperText, required, fullWidth = true, className, id, rows = 3, ...rest },
  ref,
) {
  const elId = id || React.useId();
  const hasError = Boolean(error);
  const classes = ['smc-textarea', hasError && 'smc-textarea--invalid', className || '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="smc-field" style={fullWidth ? undefined : { width: 'auto' }}>
      {label && (
        <label
          className={`smc-field__label ${required ? 'smc-field__label--required' : ''}`}
          htmlFor={elId}
        >
          {label}
        </label>
      )}
      <textarea ref={ref} id={elId} rows={rows} className={classes} {...rest} />
      {(error || helperText) && (
        <div className="smc-field__error" style={!hasError ? { color: 'var(--smc-text-3)' } : undefined}>
          {error || helperText}
        </div>
      )}
    </div>
  );
});

export default Textarea;
