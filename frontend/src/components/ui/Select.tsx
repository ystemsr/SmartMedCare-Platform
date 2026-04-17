import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption<V extends string | number = string | number> {
  label: React.ReactNode;
  value: V;
  disabled?: boolean;
}

export interface SelectProps<V extends string | number = string | number> {
  options: SelectOption<V>[];
  value?: V | '';
  defaultValue?: V;
  onChange?: (value: V) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: React.ReactNode;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'md';
  className?: string;
  id?: string;
  name?: string;
  emptyText?: string;
  renderValue?: (value: V | undefined) => React.ReactNode;
}

function Select<V extends string | number = string | number>({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = '请选择',
  disabled,
  label,
  error,
  helperText,
  required,
  fullWidth = true,
  className,
  id,
  name,
  emptyText = '无数据',
  renderValue,
}: SelectProps<V>) {
  const [internalValue, setInternalValue] = useState<V | ''>(
    value !== undefined ? value : (defaultValue ?? ''),
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const elId = id || React.useId();

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const handleSelect = useCallback(
    (opt: SelectOption<V>) => {
      if (opt.disabled) return;
      if (value === undefined) setInternalValue(opt.value);
      onChange?.(opt.value);
      setOpen(false);
    },
    [onChange, value],
  );

  const hasError = Boolean(error);
  const current = options.find((o) => o.value === internalValue);
  const display = renderValue
    ? renderValue(internalValue === '' ? undefined : (internalValue as V))
    : current
      ? current.label
      : <span className="smc-select__placeholder">{placeholder}</span>;

  return (
    <div className={`smc-field ${className || ''}`} style={fullWidth ? undefined : { width: 'auto' }}>
      {label && (
        <label
          className={`smc-field__label ${required ? 'smc-field__label--required' : ''}`}
          htmlFor={elId}
        >
          {label}
        </label>
      )}
      <div className={`smc-select ${open ? 'smc-select--open' : ''}`} ref={wrapRef}>
        <button
          id={elId}
          type="button"
          className="smc-select__trigger"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={hasError ? { borderColor: 'var(--smc-error)' } : undefined}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</span>
          <ChevronDown size={16} className="smc-select__caret" aria-hidden />
        </button>
        {name && <input type="hidden" name={name} value={String(internalValue ?? '')} />}
        {open && (
          <div className="smc-select__popover" role="listbox">
            {options.length === 0 ? (
              <div className="smc-select__empty">{emptyText}</div>
            ) : (
              options.map((opt) => (
                <div
                  key={String(opt.value)}
                  role="option"
                  aria-selected={opt.value === internalValue}
                  className={[
                    'smc-select__option',
                    opt.value === internalValue && 'smc-select__option--active',
                    opt.disabled && 'smc-select__option--disabled',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {(error || helperText) && (
        <div className="smc-field__error" style={!hasError ? { color: 'var(--smc-text-3)' } : undefined}>
          {error || helperText}
        </div>
      )}
    </div>
  );
}

export default Select;
