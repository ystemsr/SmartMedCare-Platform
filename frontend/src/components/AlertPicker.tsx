import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { getAlerts, getAlertDetail } from '../api/alerts';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import { formatDateTime, formatAlertStatus, formatRiskLevel } from '../utils/formatter';
import { RISK_LEVEL_COLORS } from '../utils/constants';
import type { Alert } from '../types/alert';

export interface AlertSummary {
  id: number;
  title: string;
  risk_level: string;
  status?: string;
}

export type AlertPickerValue = number | number[] | '' | null;

export interface AlertPickerProps {
  label?: React.ReactNode;
  /** Single ID, or array of IDs in multi mode. */
  value?: AlertPickerValue;
  /** Receives a single ID (single mode) or an array of IDs (multi mode). */
  onChange?: (value: number | number[] | '') => void;
  /** Elder the alerts must belong to. When empty the picker is disabled. */
  elderId?: number | '' | null;
  /** Allow picking multiple alerts. */
  multi?: boolean;
  /** Hide alerts already attached to a todo/in-progress followup. */
  excludeLinked?: boolean;
  /** Alerts to always keep visible even when excludeLinked is true (edit mode). */
  keepIds?: number[];
  /** Optional pre-resolved alerts so chips render before any fetch happens. */
  initialAlerts?: AlertSummary[];
  initialLabel?: string;
  placeholder?: string;
  required?: boolean;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}

function summarize(alert: Alert | AlertSummary): AlertSummary {
  return {
    id: alert.id,
    title: alert.title,
    risk_level: alert.risk_level,
    status: (alert as Alert).status,
  };
}

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  processing: 1,
  resolved: 2,
  ignored: 3,
};

function sortAlerts(items: Alert[]): Alert[] {
  return [...items].sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (so !== 0) return so;
    return (b.triggered_at || '').localeCompare(a.triggered_at || '');
  });
}

const AlertPicker: React.FC<AlertPickerProps> = ({
  label,
  value,
  onChange,
  elderId,
  multi = false,
  excludeLinked = false,
  keepIds,
  initialAlerts,
  initialLabel,
  placeholder = '搜索预警标题（可选）',
  required,
  error,
  helperText,
  disabled,
  fullWidth = true,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  // Cache of resolved alert summaries keyed by id, so we can render chips/labels.
  const [knownAlerts, setKnownAlerts] = useState<Record<number, AlertSummary>>(() => {
    const seed: Record<number, AlertSummary> = {};
    for (const a of initialAlerts ?? []) seed[a.id] = a;
    return seed;
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const elId = React.useId();
  const hasError = Boolean(error);
  const hasElder = elderId !== undefined && elderId !== null && elderId !== '';
  const effectiveDisabled = disabled || !hasElder;
  const anchor = useAnchoredPopover(open, triggerRef, multi ? 360 : 320);

  const selectedIds = useMemo<number[]>(() => {
    if (multi) {
      if (Array.isArray(value)) return value.filter((v): v is number => typeof v === 'number');
      return [];
    }
    if (typeof value === 'number') return [value];
    return [];
  }, [multi, value]);

  const hasValue = selectedIds.length > 0;

  // Reset selection when the elder context changes after initial mount.
  const prevElderIdRef = useRef<typeof elderId>(elderId);
  useEffect(() => {
    if (prevElderIdRef.current !== elderId) {
      if (prevElderIdRef.current !== undefined && hasValue) {
        onChange?.(multi ? [] : '');
      }
      prevElderIdRef.current = elderId;
    }
  }, [elderId, hasValue, onChange, multi]);

  // Resolve labels for any selected IDs we haven't seen yet.
  useEffect(() => {
    const missing = selectedIds.filter((id) => !knownAlerts[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((id) =>
        getAlertDetail(id)
          .then((res) => res.data as Alert | undefined)
          .catch(() => undefined),
      ),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<number, AlertSummary> = {};
      results.forEach((alert, idx) => {
        const id = missing[idx];
        if (alert) next[id] = summarize(alert);
        else next[id] = { id, title: `#${id}`, risk_level: '', status: '' };
      });
      setKnownAlerts((prev) => ({ ...prev, ...next }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIds, knownAlerts]);

  // Close on outside click / Esc, scoped to trigger + portal popover.
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

  // Debounced search, scoped to the selected elder.
  useEffect(() => {
    if (!open || !hasElder) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      getAlerts({
        page: 1,
        page_size: 20,
        elder_id: Number(elderId),
        title: keyword || undefined,
        exclude_linked: excludeLinked || undefined,
        keep_ids: keepIds && keepIds.length ? keepIds : undefined,
      })
        .then((res) => {
          if (cancelled) return;
          const sorted = sortAlerts(res.data.items);
          setOptions(sorted);
          // Cache summaries so deselect-then-reselect keeps chip labels intact.
          setKnownAlerts((prev) => {
            const next = { ...prev };
            for (const a of sorted) next[a.id] = summarize(a);
            return next;
          });
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
  }, [keyword, open, elderId, hasElder, excludeLinked, keepIds]);

  const handleOpen = () => {
    if (effectiveDisabled) return;
    setOpen(true);
    setKeyword('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commit = useCallback(
    (next: number[]) => {
      if (multi) {
        onChange?.(next);
      } else {
        onChange?.(next[0] ?? '');
      }
    },
    [multi, onChange],
  );

  const toggleSelection = useCallback(
    (alert: Alert) => {
      setKnownAlerts((prev) => ({ ...prev, [alert.id]: summarize(alert) }));
      if (multi) {
        const exists = selectedIds.includes(alert.id);
        const next = exists
          ? selectedIds.filter((id) => id !== alert.id)
          : [...selectedIds, alert.id];
        commit(next);
      } else {
        commit([alert.id]);
        setOpen(false);
      }
    },
    [commit, multi, selectedIds],
  );

  const removeOne = useCallback(
    (id: number) => {
      commit(selectedIds.filter((x) => x !== id));
    },
    [commit, selectedIds],
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    commit([]);
  };

  const triggerPlaceholder = !hasElder ? '请先选择老人' : placeholder;

  // Trigger contents: chips for multi mode, single label otherwise.
  const triggerContent = (() => {
    if (selectedIds.length === 0) {
      return (
        <span className="smc-select__placeholder">
          {initialLabel || triggerPlaceholder}
        </span>
      );
    }
    if (multi) {
      return (
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
          {selectedIds.map((id) => {
            const summary = knownAlerts[id];
            const color = RISK_LEVEL_COLORS[summary?.risk_level || ''] || 'var(--smc-text-3)';
            return (
              <span
                key={id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 12,
                  color,
                  border: `1px solid ${color}`,
                  background: 'var(--smc-surface)',
                  maxWidth: 220,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {summary?.title || `#${id}`}
                </span>
                {!effectiveDisabled && (
                  <X
                    size={11}
                    aria-label="移除"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOne(id);
                    }}
                  />
                )}
              </span>
            );
          })}
        </span>
      );
    }
    const id = selectedIds[0];
    const summary = knownAlerts[id];
    const text = summary
      ? `${formatRiskLevel(summary.risk_level)} · ${summary.title}`
      : initialLabel || `#${id}`;
    return (
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {text}
      </span>
    );
  })();

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
                <div className="smc-select__empty">该老人暂无可关联预警</div>
              ) : (
                options.map((alert) => {
                  const riskColor = RISK_LEVEL_COLORS[alert.risk_level] || 'var(--smc-text-3)';
                  const checked = selectedIds.includes(alert.id);
                  return (
                    <div
                      key={alert.id}
                      role="option"
                      aria-selected={checked}
                      className={[
                        'smc-select__option',
                        checked && 'smc-select__option--active',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => toggleSelection(alert)}
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          fontWeight: 600,
                        }}
                      >
                        {multi && (
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            style={{ pointerEvents: 'none' }}
                          />
                        )}
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            fontSize: 12,
                            borderRadius: 4,
                            color: riskColor,
                            border: `1px solid ${riskColor}`,
                          }}
                        >
                          {formatRiskLevel(alert.risk_level)}
                        </span>
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {alert.title}
                        </span>
                      </span>
                      <span style={{ fontSize: 'var(--smc-fs-sm)', color: 'var(--smc-text-3)' }}>
                        {formatAlertStatus(alert.status)} · {formatDateTime(alert.triggered_at)}
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
          style={{
            ...(hasError ? { borderColor: 'var(--smc-error)' } : undefined),
            minHeight: multi ? 38 : undefined,
            height: multi ? 'auto' : undefined,
            paddingTop: multi ? 4 : undefined,
            paddingBottom: multi ? 4 : undefined,
          }}
        >
          {triggerContent}
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

export default AlertPicker;
