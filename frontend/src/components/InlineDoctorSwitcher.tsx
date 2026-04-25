import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import http from '../api/http';
import { Chip, Spinner } from './ui';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import type { ApiResponse } from '../types/common';

interface DoctorOption {
  id: number;
  username: string;
  real_name?: string | null;
  phone?: string | null;
}

export interface InlineDoctorSwitcherProps {
  currentDoctorId?: number | null;
  currentDoctorName?: string | null;
  onSelect: (doctorId: number | null) => Promise<void> | void;
}

function searchDoctors(keyword?: string): Promise<ApiResponse<DoctorOption[]>> {
  return http.get('/users/doctors', {
    params: { keyword: keyword || undefined, limit: 20 },
  });
}

const InlineDoctorSwitcher: React.FC<InlineDoctorSwitcherProps> = ({
  currentDoctorId,
  currentDoctorName,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const anchor = useAnchoredPopover(open, triggerRef);

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
  }, [keyword, open]);

  const handleTriggerClick = () => {
    if (submitting) return;
    if (open) {
      setOpen(false);
      return;
    }
    setKeyword('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commit = async (doctorId: number | null) => {
    setSubmitting(true);
    try {
      await onSelect(doctorId);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const triggerContent = (() => {
    if (submitting) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Spinner size="sm" /> 更新中...
        </span>
      );
    }
    if (currentDoctorId && currentDoctorName) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {currentDoctorName}
          <ChevronDown size={12} style={{ color: 'var(--smc-text-3)' }} aria-hidden />
        </span>
      );
    }
    return (
      <Chip outlined>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          未指派
          <ChevronDown size={12} style={{ color: 'var(--smc-text-3)' }} aria-hidden />
        </span>
      </Chip>
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
                style={{
                  border: 'none',
                  height: 28,
                  padding: 0,
                  background: 'transparent',
                }}
                placeholder="搜索医生姓名 / 账号 / 手机号"
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
              {currentDoctorId && (
                <div
                  role="option"
                  className="smc-select__option"
                  onClick={() => commit(null)}
                  style={{
                    color: 'var(--smc-error)',
                    fontWeight: 500,
                  }}
                >
                  清除指派
                </div>
              )}
              {loading ? (
                <div className="smc-select__empty">搜索中...</div>
              ) : options.length === 0 ? (
                <div className="smc-select__empty">无匹配医生</div>
              ) : (
                options.map((doctor) => (
                  <div
                    key={doctor.id}
                    role="option"
                    aria-selected={doctor.id === currentDoctorId}
                    className={[
                      'smc-select__option',
                      doctor.id === currentDoctorId &&
                        'smc-select__option--active',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => commit(doctor.id)}
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
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleTriggerClick();
        }}
        disabled={submitting}
        title="点击切换负责医生"
        style={{
          background: 'transparent',
          border: 'none',
          padding: '2px 4px',
          margin: '-2px -4px',
          borderRadius: 6,
          cursor: submitting ? 'wait' : 'pointer',
          color: 'var(--smc-text)',
          textAlign: 'left',
          font: 'inherit',
        }}
        onMouseEnter={(e) => {
          if (!submitting)
            e.currentTarget.style.background = 'var(--smc-surface-alt)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {triggerContent}
      </button>
      {popover}
    </>
  );
};

export default InlineDoctorSwitcher;
