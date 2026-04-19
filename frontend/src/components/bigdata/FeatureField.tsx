import React from 'react';
import { Chip, Input, Select, Tooltip } from '@/components/ui';
import { HelpCircle, Lock } from 'lucide-react';
import type { FeatureCatalogEntry } from '../../types/survey';

interface FeatureFieldProps {
  entry: FeatureCatalogEntry;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** One of: auto | permanent | doctor | elder | health_record | survey. */
  sourceLabel?: string | null;
  disabled?: boolean;
  required?: boolean;
  /** Optional emphasis when a gap needs doctor/elder attention. */
  highlight?: boolean;
  readonly?: boolean;
}

const SOURCE_LABELS: Record<string, { text: string; tone: 'info' | 'default' | 'success' }> = {
  auto: { text: '来自基础档案', tone: 'info' },
  profile: { text: '来自基础档案', tone: 'info' },
  health_record: { text: '来自健康记录', tone: 'info' },
  permanent: { text: '已保存信息（可修改）', tone: 'default' },
  doctor: { text: '医生填写', tone: 'default' },
  elder: { text: '本次由您填写', tone: 'success' },
  survey: { text: '来自老人填写', tone: 'success' },
};

function humanSource(
  src: string | null | undefined,
): { text: string; tone: 'info' | 'default' | 'success' } | null {
  if (!src) return null;
  return SOURCE_LABELS[src] || { text: src, tone: 'default' };
}

function rangeHint(entry: FeatureCatalogEntry): string | null {
  if (entry.type !== 'number') return entry.unit || null;
  const hasMin = typeof entry.min === 'number';
  const hasMax = typeof entry.max === 'number';
  const unit = entry.unit || '分';
  if (hasMin && hasMax) return `${entry.min}-${entry.max} ${unit}`;
  if (hasMax) return `≤ ${entry.max} ${unit}`;
  if (hasMin) return `≥ ${entry.min} ${unit}`;
  return entry.unit || null;
}

const LabelWithTooltip: React.FC<{
  entry: FeatureCatalogEntry;
  required?: boolean;
  readonly?: boolean;
}> = ({ entry, required, readonly }) => {
  const hint = rangeHint(entry);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <span>
        {entry.label}
        {required ? (
          <span
            aria-label="必填"
            style={{ color: 'var(--smc-error)', fontWeight: 700, marginLeft: 2 }}
          >
            *
          </span>
        ) : null}
      </span>
      {hint ? (
        <span style={{ color: 'var(--smc-text-3)', fontWeight: 400, fontSize: 12 }}>
          ({hint})
        </span>
      ) : null}
      {readonly ? (
        <Tooltip title="此字段由系统自动填充，不可修改">
          <Lock size={12} style={{ color: 'var(--smc-text-3)' }} aria-label="只读" />
        </Tooltip>
      ) : null}
      <Tooltip title={entry.description}>
        <HelpCircle
          size={13}
          style={{ color: 'var(--smc-text-3)', cursor: 'help' }}
          aria-label="字段说明"
        />
      </Tooltip>
    </span>
  );
};

const FeatureField: React.FC<FeatureFieldProps> = ({
  entry,
  value,
  onChange,
  sourceLabel,
  disabled,
  required,
  highlight,
  readonly,
}) => {
  const sourceInfo = humanSource(sourceLabel);
  const effectiveDisabled = disabled || readonly;

  const helper = sourceInfo ? (
    <Chip tone={sourceInfo.tone} outlined>
      {sourceInfo.text}
    </Chip>
  ) : undefined;

  const wrapStyle: React.CSSProperties = highlight
    ? {
        border: '1px solid color-mix(in oklab, var(--smc-warning) 55%, transparent)',
        borderRadius: 10,
        padding: 8,
        background: 'color-mix(in oklab, var(--smc-warning) 8%, transparent)',
      }
    : {};

  if (entry.type === 'enum' && entry.options) {
    return (
      <div style={wrapStyle}>
        <Select<string>
          label={<LabelWithTooltip entry={entry} required={required} readonly={readonly} />}
          helperText={helper}
          disabled={effectiveDisabled}
          value={value == null ? '' : String(value)}
          onChange={(next) => onChange(next === '' ? null : Number(next))}
          options={[
            { label: '未填写', value: '' },
            ...entry.options.map((o) => ({ label: o.label, value: String(o.value) })),
          ]}
        />
      </div>
    );
  }

  if (entry.type === 'boolean') {
    return (
      <div style={wrapStyle}>
        <Select<string>
          label={<LabelWithTooltip entry={entry} required={required} readonly={readonly} />}
          helperText={helper}
          disabled={effectiveDisabled}
          value={value == null ? '' : String(value)}
          onChange={(next) => onChange(next === '' ? null : Number(next))}
          options={[
            { label: '未填写', value: '' },
            { label: '是', value: '1' },
            { label: '否', value: '0' },
          ]}
        />
      </div>
    );
  }

  const inputValue = value == null || Number.isNaN(value) ? '' : String(value);
  return (
    <div style={wrapStyle}>
      <Input
        label={<LabelWithTooltip entry={entry} required={required} readonly={readonly} />}
        helperText={helper}
        disabled={effectiveDisabled}
        type="number"
        min={entry.min}
        max={entry.max}
        step={1}
        value={inputValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
      />
    </div>
  );
};

export default FeatureField;
