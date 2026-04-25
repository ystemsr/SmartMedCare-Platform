import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { getFollowups, getFollowupDetail } from '../api/followups';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import {
  formatDateTime,
  formatFollowupStatus,
  formatPlanType,
} from '../utils/formatter';
import { FOLLOWUP_STATUS_COLORS } from '../utils/constants';
import type { Followup } from '../types/followup';

export interface FollowupPickerProps {
  label?: React.ReactNode;
  value?: number | '' | null;
  onChange?: (id: number | '') => void;
  /** Elder the followups must belong to. When empty the picker is disabled. */
  elderId?: number | '' | null;
  /** When true (default), hide completed/cancelled followups from the dropdown. */
  activeOnly?: boolean;
  initialLabel?: string;
  placeholder?: string;
  required?: boolean;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  todo: 1,
  overdue: 2,
  completed: 3,
  cancelled: 4,
};

function formatOption(followup: Followup): string {
  return `${formatPlanType(followup.plan_type)} · ${formatFollowupStatus(followup.status)}`;
}

const FollowupPicker: React.FC<FollowupPickerProps> = ({
  label,
  value,
  onChange,
  elderId,
  activeOnly = true,
  initialLabel,
  placeholder = '搜索该老人的随访（按状态/方式排序）',
  required,
  error,
  helperText,
  disabled,
  fullWidth = true,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  // Per-instance toggle to override activeOnly within a single picker session.
  const [showAll, setShowAll] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const elId = React.useId();
  const hasError = Boolean(error);
  const hasValue = value !== undefined && value !== null && value !== '';
  const hasElder = elderId !== undefined && elderId !== null && elderId !== '';
  const effectiveDisabled = disabled || !hasElder;
  const anchor = useAnchoredPopover(open, triggerRef, 320);

  // When the elder context changes after first mount, drop the selection.
  const prevElderIdRef = useRef<typeof elderId>(elderId);
  useEffect(() => {
    if (prevElderIdRef.current !== elderId) {
      if (prevElderIdRef.current !== undefined && hasValue) {
        onChange?.('');
        setSelectedLabel('');
      }
      prevElderIdRef.current = elderId;
    }
  }, [elderId, hasValue, onChange]);

  // Resolve the display label for a prefilled value (edit mode).
  useEffect(() => {
    if (!hasValue) {
      setSelectedLabel('');
      return;
    }
    if (initialLabel) {
      setSelectedLabel(initialLabel);
      return;
    }
    let cancelled = false;
    getFollowupDetail(Number(value))
      .then((res) => {
        if (cancelled) return;
        const followup = res.data as Followup | undefined;
        if (followup) setSelectedLabel(formatOption(followup));
      })
      .catch(() => {
        if (!cancelled) setSelectedLabel(`#${value}`);
      });
    return () => {
      cancelled = true;
    };
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

  // Fetch followups for the selected elder when the picker opens.
  useEffect(() => {
    if (!open || !hasElder) return;
    let cancelled = false;
    setLoading(true);
    getFollowups({
      page: 1,
      page_size: 30,
      elder_id: Number(elderId),
      active_only: activeOnly && !showAll ? true : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        const sorted = [...res.data.items].sort((a, b) => {
          const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          if (so !== 0) return so;
          return (b.planned_at || '').localeCompare(a.planned_at || '');
        });
        setOptions(sorted);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, elderId, hasElder, activeOnly, showAll]);

  const handleOpen = () => {
    if (effectiveDisabled) return;
    setOpen(true);
  };

  const handleSelect = useCallback(
    (followup: Followup) => {
      onChange?.(followup.id);
      setSelectedLabel(formatOption(followup));
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
    setSelectedLabel('');
  };

  const triggerPlaceholder = !hasElder ? '请先选择老人' : placeholder;
  const displayText = selectedLabel || (
    <span className="smc-select__placeholder">{triggerPlaceholder}</span>
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
              top: anchor.top,
              bottom: anchor.bottom,
              left: anchor.left,
              right: 'auto',
              width: Math.max(260, anchor.width),
              maxHeight: anchor.maxHeight,
              padding: 0,
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
                color: 'var(--smc-text-3)',
                fontSize: 'var(--smc-fs-sm)',
              }}
            >
              <Search size={14} aria-hidden />
              <span style={{ flex: 1 }}>
                {activeOnly && !showAll
                  ? '仅显示进行中/待执行/逾期'
                  : '显示全部状态'}
              </span>
              {activeOnly && (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: 'pointer',
                    color: 'var(--smc-text-2)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                  />
                  显示全部
                </label>
              )}
            </div>
            <div
              style={{
                maxHeight: Math.max(160, anchor.maxHeight - 48),
                overflowY: 'auto',
                padding: 4,
              }}
            >
              {loading ? (
                <div className="smc-select__empty">加载中...</div>
              ) : options.length === 0 ? (
                <div className="smc-select__empty">
                  {activeOnly && !showAll
                    ? '该老人暂无进行中的随访（可勾选「显示全部」查看历史记录）'
                    : '该老人暂无随访记录'}
                </div>
              ) : (
                options.map((followup) => {
                  const statusColor =
                    FOLLOWUP_STATUS_COLORS[followup.status] || 'var(--smc-text-3)';
                  return (
                    <div
                      key={followup.id}
                      role="option"
                      aria-selected={followup.id === value}
                      className={[
                        'smc-select__option',
                        followup.id === value && 'smc-select__option--active',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleSelect(followup)}
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                          width: '100%',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            fontSize: 12,
                            borderRadius: 4,
                            color: statusColor,
                            border: `1px solid ${statusColor}`,
                          }}
                        >
                          {formatFollowupStatus(followup.status)}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatPlanType(followup.plan_type)}
                        </span>
                      </span>
                      <span style={{ fontSize: 'var(--smc-fs-sm)', color: 'var(--smc-text-3)' }}>
                        计划 {formatDateTime(followup.planned_at) || '-'}
                        {followup.assigned_to_name
                          ? ` · 负责人 ${followup.assigned_to_name}`
                          : ''}
                      </span>
                    </div>
                  );
                })
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
          disabled={effectiveDisabled}
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
          {hasValue && !effectiveDisabled ? (
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

export default FollowupPicker;
