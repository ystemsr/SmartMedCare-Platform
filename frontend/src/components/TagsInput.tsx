import React, { useId, useState } from 'react';
import { X } from 'lucide-react';
import { Chip } from './ui';

export interface TagsInputProps {
  label?: React.ReactNode;
  value?: string[];
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: React.ReactNode;
  helperText?: React.ReactNode;
  maxTags?: number;
}

const TagsInput: React.FC<TagsInputProps> = ({
  label,
  value = [],
  onChange,
  placeholder = '输入后按回车添加',
  required,
  disabled,
  error,
  helperText,
  maxTags,
}) => {
  const elId = useId();
  const [draft, setDraft] = useState('');
  const hasError = Boolean(error);

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (value.includes(tag)) {
      setDraft('');
      return;
    }
    if (maxTags !== undefined && value.length >= maxTags) {
      return;
    }
    onChange?.([...value, tag]);
    setDraft('');
  };

  const removeAt = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === 'Backspace' && !draft && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  };

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
      <div
        className="smc-input"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          minHeight: 36,
          alignItems: 'center',
          padding: '4px 8px',
          cursor: disabled ? 'not-allowed' : 'text',
          borderColor: hasError ? 'var(--smc-error)' : undefined,
        }}
        onClick={() => {
          if (disabled) return;
          document.getElementById(elId)?.focus();
        }}
      >
        {value.map((tag, idx) => (
          <Chip key={`${tag}-${idx}`} tone="primary" outlined>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {tag}
              {!disabled && (
                <X
                  size={12}
                  aria-label={`移除 ${tag}`}
                  style={{ cursor: 'pointer', color: 'var(--smc-text-3)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(idx);
                  }}
                />
              )}
            </span>
          </Chip>
        ))}
        <input
          id={elId}
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{
            flex: 1,
            minWidth: 120,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 'var(--smc-fs-md)',
            padding: '4px 0',
          }}
        />
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

export default TagsInput;
