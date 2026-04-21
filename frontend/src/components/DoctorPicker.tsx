import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import http from '../api/http';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import type { ApiResponse } from '../types/common';

export interface DoctorOption {
  id: number;
  username: string;
  real_name?: string | null;
  phone?: string | null;
}

export interface DoctorPickerProps {
  label?: React.ReactNode;
  value?: number | '' | null;
  onChange?: (id: number | '') => void;
  initialLabel?: string;
  placeholder?: string;
  required?: boolean;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}

function searchDoctors(keyword?: string): Promise<ApiResponse<DoctorOption[]>> {
  return http.get('/users/doctors', { params: { keyword: keyword || undefined, limit: 20 } });
}

function formatOption(doctor: DoctorOption): string {
  const name = doctor.real_name || doctor.username;
  return doctor.phone ? `${name} · ${doctor.phone}` : name;
}

const DoctorPicker: React.FC<DoctorPickerProps> = ({
  label,
  value,
  onChange,
  initialLabel,
  placeholder = '搜索医生姓名 / 账号 / 手机号',
  required,
  error,
  helperText,
  disabled,
  fullWidth = true,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const elId = React.useId();
  const hasError = Boolean(error);
  const hasValue = value !== undefined && value !== null && value !== '';
  const anchor = useAnchoredPopover(open, triggerRef);

  useEffect(() => {
    if (!hasValue) {
      setSelectedLabel('');
      return;
    }
    if (initialLabel) {
      setSelectedLabel(initialLabel);
      return;
    }
    setSelectedLabel((prev) => prev || `#${value}`);
  }, [value, initialLabel, hasValue]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchDoctors(keyword)
        .then((res) => {
          if (cancelled) return;
          setOptions(res.data || []);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [keyword, open]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setKeyword('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = useCallback(
    (doctor: DoctorOption) => {
      onChange?.(doctor.id);
      setSelectedLabel(formatOption(doctor));
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setSelectedLabel('');
  };

  const displayText = selectedLabel || (
    <span className="smc-select__placeholder">{placeholder}</span>
  );

  const popover =
    open && anchor
      ? ReactDOM.createPortal(
          <div
            ref={popoverRef}
            className="smc-select__popover"
            role="listbox"
            style={{
              position: 'fixed',
              top: anchor.flipUp ? undefined : anchor.top,
              bottom: anchor.flipUp ? window.innerHeight - anchor.top : undefined,
              left: anchor.left,
              width: anchor.width,
              maxHeight: anchor.maxHeight,
              padding: 0,
              // Sit above .smc-modal-overlay (1300) when rendered via portal.
              zIndex: 1500,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderBottom: '1px solid var(--smc-border)',
              }}
            >
              <Search size={14} style={{ color: 'var(--smc-text-3)' }} aria-hidden />
              <input
                ref={inputRef}
                className="smc-input"
                style={{ border: 'none', height: 28, padding: 0, background: 'transparent' }}
                placeholder={placeholder}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div
              style={{
                maxHeight: Math.max(160, anchor.maxHeight - 48),
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {loading ? (
                <div className="smc-select__empty">搜索中...</div>
              ) : options.length === 0 ? (
                <div className="smc-select__empty">无匹配医生</div>
              ) : (
                options.map((doctor) => (
                  <div
                    key={doctor.id}
                    role="option"
                    aria-selected={doctor.id === value}
                    className={[
                      'smc-select__option',
                      doctor.id === value && 'smc-select__option--active',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleSelect(doctor)}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {doctor.real_name || doctor.username}
                    </span>
                    <span style={{ fontSize: 'var(--smc-fs-sm)', color: 'var(--smc-text-3)' }}>
                      {doctor.username}
                      {doctor.phone ? ` · ${doctor.phone}` : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

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
      <div className={`smc-select ${open ? 'smc-select--open' : ''}`}>
        <button
          ref={triggerRef}
          id={elId}
          type="button"
          className="smc-select__trigger"
          onClick={handleOpen}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={hasError ? { borderColor: 'var(--smc-error)' } : undefined}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {displayText}
          </span>
          {hasValue && !disabled ? (
            <X
              size={14}
              aria-label="清除"
              style={{ color: 'var(--smc-text-3)', cursor: 'pointer' }}
              onClick={handleClear}
            />
          ) : (
            <ChevronDown size={16} className="smc-select__caret" aria-hidden />
          )}
        </button>
        {popover}
      </div>
      {(error || helperText) && (
        <div
          className="smc-field__error"
          style={!hasError ? { color: 'var(--smc-text-3)' } : undefined}
        >
          {error || helperText}
        </div>
      )}
    </div>
  );
};

export default DoctorPicker;
