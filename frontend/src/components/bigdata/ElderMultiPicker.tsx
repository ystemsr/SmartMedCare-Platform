import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Chip } from '@/components/ui';
import { getElders } from '../../api/elders';

interface Option {
  id: number;
  name: string;
  phone?: string;
  id_card?: string;
}

interface Props {
  label?: React.ReactNode;
  value: number[];
  onChange: (ids: number[]) => void;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
}

function maskIdCard(s?: string): string {
  if (!s) return '';
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}****${s.slice(-4)}`;
}

const ElderMultiPicker: React.FC<Props> = ({
  label,
  value,
  onChange,
  max = 50,
  placeholder = '搜索老人姓名 / 手机号 / 身份证号',
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameCache, setNameCache] = useState<Record<number, string>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
      getElders({ page: 1, page_size: 20, keyword: keyword || undefined })
        .then((res) => {
          if (cancelled) return;
          const items = res.data.items as Option[];
          setOptions(items);
          setNameCache((prev) => {
            const next = { ...prev };
            items.forEach((o) => {
              next[o.id] = o.name;
            });
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
  }, [keyword, open]);

  const toggle = useCallback(
    (id: number) => {
      if (value.includes(id)) {
        onChange(value.filter((v) => v !== id));
        return;
      }
      if (value.length >= max) {
        return;
      }
      onChange([...value, id]);
    },
    [onChange, value, max],
  );

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setKeyword('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeId = (id: number) => {
    onChange(value.filter((v) => v !== id));
  };

  const atLimit = value.length >= max;

  return (
    <div className="smc-field">
      {label && <label className="smc-field__label">{label}</label>}
      <div
        ref={wrapRef}
        className={`smc-select ${open ? 'smc-select--open' : ''}`}
      >
        <button
          type="button"
          className="smc-select__trigger"
          onClick={handleOpen}
          disabled={disabled}
          style={{
            minHeight: 40,
            alignItems: 'flex-start',
            paddingTop: 6,
            paddingBottom: 6,
            height: 'auto',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              minHeight: 24,
              alignItems: 'center',
              textAlign: 'left',
            }}
          >
            {value.length === 0 ? (
              <span className="smc-select__placeholder">{placeholder}</span>
            ) : (
              value.map((id) => (
                <Chip
                  key={id}
                  tone="info"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeId(id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {nameCache[id] || `#${id}`}
                  <X size={12} style={{ marginLeft: 4 }} />
                </Chip>
              ))
            )}
          </div>
          <ChevronDown
            size={16}
            className="smc-select__caret"
            aria-hidden
            style={{ alignSelf: 'center' }}
          />
        </button>
        {open && (
          <div className="smc-select__popover" style={{ padding: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderBottom: '1px solid var(--smc-border)',
              }}
            >
              <Search size={14} style={{ color: 'var(--smc-text-3)' }} />
              <input
                ref={inputRef}
                className="smc-input"
                style={{
                  border: 'none',
                  height: 28,
                  padding: 0,
                  background: 'transparent',
                  flex: 1,
                }}
                placeholder={placeholder}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div
              style={{
                padding: '6px 10px',
                borderBottom: '1px solid var(--smc-border)',
                fontSize: 12,
                color: 'var(--smc-text-3)',
              }}
            >
              已选 {value.length}/{max}
              {atLimit ? '（已达上限）' : ''}
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: 4 }}>
              {loading ? (
                <div className="smc-select__empty">搜索中...</div>
              ) : options.length === 0 ? (
                <div className="smc-select__empty">无匹配老人</div>
              ) : (
                options.map((elder) => {
                  const selected = value.includes(elder.id);
                  const disabledOpt = !selected && atLimit;
                  return (
                    <div
                      key={elder.id}
                      className={[
                        'smc-select__option',
                        selected && 'smc-select__option--active',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => !disabledOpt && toggle(elder.id)}
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 2,
                        opacity: disabledOpt ? 0.45 : 1,
                        cursor: disabledOpt ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          readOnly
                          disabled={disabledOpt}
                          style={{ pointerEvents: 'none' }}
                        />
                        <span style={{ fontWeight: 600 }}>{elder.name}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 'var(--smc-fs-sm)',
                          color: 'var(--smc-text-3)',
                        }}
                      >
                        {elder.phone || '无手机号'} ·{' '}
                        {maskIdCard(elder.id_card) || '无身份证'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      <div className="smc-field__error" style={{ color: 'var(--smc-text-3)' }}>
        点击标签可移除。单次最多 {max} 人。
      </div>
    </div>
  );
};

export default ElderMultiPicker;
