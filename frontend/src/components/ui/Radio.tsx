import React from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={['smc-check smc-check--radio', className || ''].filter(Boolean).join(' ')}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input ref={ref} type="radio" className="smc-check__input" {...rest} />
        <span className="smc-check__box" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
});

export interface RadioGroupProps<V extends string | number = string> {
  value?: V;
  defaultValue?: V;
  onChange?: (v: V) => void;
  options: { label: React.ReactNode; value: V; disabled?: boolean }[];
  name?: string;
  direction?: 'row' | 'column';
}

export function RadioGroup<V extends string | number = string>({
  value,
  defaultValue,
  onChange,
  options,
  name,
  direction = 'row',
}: RadioGroupProps<V>) {
  const [internal, setInternal] = React.useState<V | undefined>(
    value !== undefined ? value : defaultValue,
  );
  React.useEffect(() => {
    if (value !== undefined) setInternal(value);
  }, [value]);
  const gname = name || React.useId();
  const current = value ?? internal;
  return (
    <div style={{ display: 'flex', gap: 16, flexDirection: direction }}>
      {options.map((opt) => (
        <Radio
          key={String(opt.value)}
          name={gname}
          value={String(opt.value)}
          checked={current === opt.value}
          disabled={opt.disabled}
          label={opt.label}
          onChange={() => {
            if (value === undefined) setInternal(opt.value);
            onChange?.(opt.value);
          }}
        />
      ))}
    </div>
  );
}

export default Radio;
