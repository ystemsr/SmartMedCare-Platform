import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';

export interface DatePickerProps {
  value?: string | null;
  onChange?: (v: string | null) => void;
  format?: string;
  placeholder?: string;
  label?: React.ReactNode;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  minDate?: string;
  maxDate?: string;
}

type ViewMode = 'day' | 'month' | 'year';

const weekHeads = ['一', '二', '三', '四', '五', '六', '日'];
const monthLabels = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  format = 'YYYY-MM-DD',
  placeholder = '选择日期',
  label,
  error,
  helperText,
  required,
  disabled,
  fullWidth = true,
  minDate,
  maxDate,
}) => {
  const elId = React.useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = value ? dayjs(value) : null;
  const [cursor, setCursor] = useState<Dayjs>(selected ?? dayjs());
  const [view, setView] = useState<ViewMode>('day');

  useEffect(() => {
    if (open) {
      setView('day');
      setCursor(selected ?? dayjs());
    }
    // Intentionally only reset when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const days = useMemo(() => {
    const start = cursor.startOf('month');
    const firstDay = ((start.day() + 6) % 7); // Monday-first
    const gridStart = start.subtract(firstDay, 'day');
    return Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));
  }, [cursor]);

  // 12-year block for the year-picker grid (year % 12 == 0 start).
  const yearBlockStart = useMemo(() => {
    const y = cursor.year();
    return y - (y % 12);
  }, [cursor]);
  const yearCells = useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearBlockStart + i),
    [yearBlockStart],
  );

  const today = dayjs().format('YYYY-MM-DD');
  const min = minDate ? dayjs(minDate) : null;
  const max = maxDate ? dayjs(maxDate) : null;

  const select = (d: Dayjs) => {
    if (min && d.isBefore(min, 'day')) return;
    if (max && d.isAfter(max, 'day')) return;
    onChange?.(d.format(format));
    setOpen(false);
  };
  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(null);
  };

  const shiftYear = (delta: number) => {
    if (view === 'year') {
      setCursor(cursor.add(delta * 12, 'year'));
    } else {
      setCursor(cursor.add(delta, 'year'));
    }
  };
  const shiftMonth = (delta: number) => setCursor(cursor.add(delta, 'month'));

  const hasError = Boolean(error);

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
      <div ref={wrapRef} className="smc-date">
        <button
          id={elId}
          type="button"
          className="smc-select__trigger"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          style={hasError ? { borderColor: 'var(--smc-error)' } : undefined}
        >
          <span style={{ color: selected ? 'inherit' : 'var(--smc-text-3)' }}>
            {selected ? selected.format(format) : placeholder}
          </span>
          <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {selected && !disabled && (
              <span
                role="button"
                onClick={clear}
                style={{ cursor: 'pointer', color: 'var(--smc-text-3)', padding: 2 }}
                aria-label="清除"
              >
                ×
              </span>
            )}
            <Calendar size={15} style={{ color: 'var(--smc-text-3)' }} />
          </span>
        </button>
        {open && (
          <div className="smc-date__panel">
            <div className="smc-date__head">
              <div style={{ display: 'inline-flex', gap: 2 }}>
                <button
                  type="button"
                  className="smc-date__nav"
                  onClick={() => shiftYear(-1)}
                  aria-label="上一年"
                  title="上一年"
                >
                  <ChevronsLeft size={16} />
                </button>
                {view === 'day' && (
                  <button
                    type="button"
                    className="smc-date__nav"
                    onClick={() => shiftMonth(-1)}
                    aria-label="上个月"
                    title="上个月"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
              </div>
              <div style={{ display: 'inline-flex', gap: 6 }}>
                {view === 'day' && (
                  <>
                    <button
                      type="button"
                      className="smc-date__title-btn"
                      onClick={() => setView('year')}
                    >
                      {cursor.format('YYYY')} 年
                    </button>
                    <button
                      type="button"
                      className="smc-date__title-btn"
                      onClick={() => setView('month')}
                    >
                      {cursor.format('MM')} 月
                    </button>
                  </>
                )}
                {view === 'month' && (
                  <button
                    type="button"
                    className="smc-date__title-btn"
                    onClick={() => setView('year')}
                  >
                    {cursor.format('YYYY')} 年
                  </button>
                )}
                {view === 'year' && (
                  <span className="smc-date__title">
                    {yearBlockStart} - {yearBlockStart + 11}
                  </span>
                )}
              </div>
              <div style={{ display: 'inline-flex', gap: 2 }}>
                {view === 'day' && (
                  <button
                    type="button"
                    className="smc-date__nav"
                    onClick={() => shiftMonth(1)}
                    aria-label="下个月"
                    title="下个月"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className="smc-date__nav"
                  onClick={() => shiftYear(1)}
                  aria-label="下一年"
                  title="下一年"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>

            {view === 'day' && (
              <div className="smc-date__grid">
                {weekHeads.map((w) => (
                  <div key={w} className="smc-date__cell smc-date__cell--head">
                    {w}
                  </div>
                ))}
                {days.map((d) => {
                  const inMonth = d.month() === cursor.month();
                  const iso = d.format('YYYY-MM-DD');
                  const disabledCell =
                    (min && d.isBefore(min, 'day')) || (max && d.isAfter(max, 'day'));
                  const isSelected = selected && d.isSame(selected, 'day');
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={[
                        'smc-date__cell',
                        !inMonth && 'smc-date__cell--out',
                        iso === today && 'smc-date__cell--today',
                        isSelected && 'smc-date__cell--selected',
                        disabledCell && 'smc-date__cell--disabled',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => select(d)}
                      disabled={Boolean(disabledCell)}
                    >
                      {d.date()}
                    </button>
                  );
                })}
              </div>
            )}

            {view === 'month' && (
              <div className="smc-date__grid smc-date__grid--months">
                {monthLabels.map((m, idx) => {
                  const isSelected =
                    selected && selected.year() === cursor.year() && selected.month() === idx;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={[
                        'smc-date__cell smc-date__cell--lg',
                        isSelected && 'smc-date__cell--selected',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setCursor(cursor.month(idx));
                        setView('day');
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {view === 'year' && (
              <div className="smc-date__grid smc-date__grid--years">
                {yearCells.map((y) => {
                  const isSelected = selected && selected.year() === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      className={[
                        'smc-date__cell smc-date__cell--lg',
                        isSelected && 'smc-date__cell--selected',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        setCursor(cursor.year(y));
                        setView('month');
                      }}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
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
};

export default DatePicker;
