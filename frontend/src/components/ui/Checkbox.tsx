import React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, className, ...rest },
  ref,
) {
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);
  React.useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);
  return (
    <label className={['smc-check', className || ''].filter(Boolean).join(' ')}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input ref={innerRef} type="checkbox" className="smc-check__input" {...rest} />
        <span className="smc-check__box" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
});

export default Checkbox;
