import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import http from '../api/http';
import type { ApiResponse } from '../types/common';

interface DoctorOption {
  id: number;
  username: string;
  real_name?: string | null;
  phone?: string | null;
}

export interface DoctorComboBoxProps {
  label?: React.ReactNode;
  value?: number | '' | null;
  onChange?: (id: number | '') => void;
  /** Display name of the currently-assigned doctor, for edit-mode prefill. */
  initialLabel?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
}

function searchDoctors(keyword?: string): Promise<ApiResponse<DoctorOption[]>> {
  return http.get('/users/doctors', {
    params: { keyword: keyword || undefined, limit: 20 },
  });
}

function formatDoctorLabel(d: DoctorOption): string {
  return d.real_name || d.username;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
  showAbove: boolean;
  maxHeight: number;
}

/**
 * Input-as-trigger doctor picker — mirrors smart-shop/CategoryInput. The
 * input itself is the trigger; typing filters the list below; clicking an
 * option commits the value. No separate search input, no button trigger.
 */
const DoctorComboBox: React.FC<DoctorComboBoxProps> = ({
  label,
  value,
  onChange,
  initialLabel,
  placeholder = '输入医生姓名 / 账号 / 手机号',
  required,
  disabled,
  error,
  helperText,
}) => {
  const elId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks the label that matches the committed value so we can revert the
  // input when the user types a query but closes without picking anything.
  const committedLabel = useRef<string>('');
  const justSelected = useRef(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<DropdownPos>({
    top: 0,
    left: 0,
    width: 0,
    showAbove: false,
    maxHeight: 260,
  });

  const hasError = Boolean(error);

  // Sync input text with the externally-set value.
  useEffect(() => {
    if (value && initialLabel) {
      committedLabel.current = initialLabel;
      setQuery(initialLabel);
    } else if (!value) {
      committedLabel.current = '';
      setQuery('');
    }
  }, [value, initialLabel]);

  // Debounced remote search while the dropdown is open.
  useEffect(() => {
    if (!showSuggestions) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchDoctors(query)
        .then((res) => {
          if (!cancelled) setOptions(res.data || []);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showSuggestions, query]);

  // Track the trigger's viewport rect while the dropdown is open and flip
  // upward when there isn't enough room below. Modelled after smart-shop's
  // CategoryInput so the behaviour matches 1:1.
  useEffect(() => {
    if (!showSuggestions || !inputRef.current) return;
    const updatePos = () => {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dropdownMax = 260;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const showAbove =
        spaceBelow < Math.min(dropdownMax, 180) && spaceAbove > spaceBelow;
      setPos({
        top: showAbove ? rect.top - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        showAbove,
        maxHeight: Math.max(160, (showAbove ? spaceAbove : spaceBelow) - 4),
      });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [showSuggestions]);

  const handleSelect = useCallback(
    (doctor: DoctorOption) => {
      const lbl = formatDoctorLabel(doctor);
      committedLabel.current = lbl;
      justSelected.current = true;
      setQuery(lbl);
      onChange?.(doctor.id);
      setShowSuggestions(false);
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (!disabled) setShowSuggestions(true);
  };

  const handleBlur = () => {
    // Delay closing so a click on an option registers first. If the user
    // typed a non-matching query, revert to the last committed label.
    window.setTimeout(() => {
      setShowSuggestions(false);
      if (justSelected.current) {
        justSelected.current = false;
        return;
      }
      if (query !== committedLabel.current) {
        setQuery(committedLabel.current);
      }
    }, 180);
  };

  const handleClear = (e: React.MouseEvent) => {
    // mousedown on the X must not steal focus from the input.
    e.preventDefault();
    e.stopPropagation();
    committedLabel.current = '';
    setQuery('');
    onChange?.('');
    setShowSuggestions(true);
    inputRef.current?.focus();
  };

  const hasText = query.length > 0;

  const popover =
    showSuggestions && typeof document !== 'undefined'
      ? ReactDOM.createPortal(
          <div
            role="listbox"
            className="smc-select__popover"
            style={{
              position: 'fixed',
              [pos.showAbove ? 'bottom' : 'top']: pos.showAbove
                ? `${window.innerHeight - pos.top}px`
                : `${pos.top}px`,
              left: `${pos.left}px`,
              width: `${Math.max(260, pos.width)}px`,
              maxHeight: `${pos.maxHeight}px`,
              padding: 4,
              zIndex: 1500,
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
                  onMouseDown={(e) => {
                    // Prevent the input from blurring before we commit.
                    e.preventDefault();
                    handleSelect(doctor);
                  }}
                  style={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {doctor.real_name || doctor.username}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--smc-fs-sm)',
                      color: 'var(--smc-text-3)',
                    }}
                  >
                    {doctor.username}
                    {doctor.phone ? ` · ${doctor.phone}` : ''}
                  </span>
                </div>
              ))
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="smc-field">
      {label && (
        <label
          className={`smc-field__label ${required ? 'smc-field__label--required' : ''}`}
          htmlFor={elId}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={elId}
          type="text"
          className="smc-input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          required={required}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-haspopup="listbox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          role="combobox"
          style={{
            paddingRight: hasText && !disabled ? 56 : 34,
            ...(hasError ? { borderColor: 'var(--smc-error)' } : {}),
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--smc-text-3)',
            pointerEvents: 'none',
          }}
        >
          {hasText && !disabled ? (
            <X
              size={14}
              aria-label="清除"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onMouseDown={handleClear}
            />
          ) : null}
          <ChevronDown size={16} aria-hidden />
        </div>
      </div>
      {popover}
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

export default DoctorComboBox;
