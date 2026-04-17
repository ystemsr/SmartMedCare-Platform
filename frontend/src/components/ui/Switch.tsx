import React from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  const content = (
    <span className={['smc-switch', className || ''].filter(Boolean).join(' ')}>
      <input ref={ref} type="checkbox" {...rest} />
      <span className="smc-switch__track" />
    </span>
  );
  if (!label) return content;
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      {content}
      <span>{label}</span>
    </label>
  );
});

export default Switch;
