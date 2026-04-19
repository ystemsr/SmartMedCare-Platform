import React from 'react';
import { Input, Select, Textarea } from '@/components/ui';
import type { JobType } from '../../types/bigdata';

interface Props {
  jobType: JobType;
  params: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const MART_OPTIONS = [
  { label: 'mart_overview （总体指标）', value: 'mart_overview' },
  { label: 'mart_risk_region （地域风险）', value: 'mart_risk_region' },
  { label: 'mart_followup_completion （随访完成）', value: 'mart_followup_completion' },
  { label: 'mart_alert_summary （预警摘要）', value: 'mart_alert_summary' },
];

const TABLE_OPTIONS = [
  { value: 'elders' },
  { value: 'health_records' },
  { value: 'medical_records' },
  { value: 'care_records' },
  { value: 'alerts' },
  { value: 'followups' },
];

const JobParamsForm: React.FC<Props> = ({ jobType, params, onChange }) => {
  const set = (key: string, value: unknown) => {
    onChange({ ...params, [key]: value });
  };

  if (jobType === 'mysql_to_hdfs') {
    const tablesValue = String(params.tables || '');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Textarea
          label="要抽取的表 (逗号分隔)"
          rows={3}
          value={tablesValue}
          onChange={(e) => set('tables', e.target.value)}
          placeholder={TABLE_OPTIONS.map((t) => t.value).join(',')}
          helperText="留空则使用脚本默认的全量表列表"
        />
        <Input
          label="输出路径 (HDFS)"
          value={String(params.output_path || '')}
          onChange={(e) => set('output_path', e.target.value)}
          placeholder="/data/raw"
        />
      </div>
    );
  }

  if (jobType === 'build_marts') {
    const selected = String(params.marts || '').split(',').filter(Boolean);
    const toggle = (m: string) => {
      const next = selected.includes(m)
        ? selected.filter((x) => x !== m)
        : [...selected, m];
      set('marts', next.join(','));
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>
          选择要刷新的数据集市（默认全部）
        </div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {MART_OPTIONS.map((m) => {
            const on = selected.length === 0 || selected.includes(m.value);
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => toggle(m.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: 'none',
                  background: on
                    ? 'color-mix(in oklab, var(--smc-primary) 12%, transparent)'
                    : 'var(--smc-surface-alt)',
                  fontSize: 13,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (jobType === 'batch_predict') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="输入 Parquet 路径"
          value={String(params.input_path || '')}
          onChange={(e) => set('input_path', e.target.value)}
          placeholder="/data/raw/elders"
          helperText="含特征数据的 HDFS 路径（留空使用脚本默认值）"
        />
        <Input
          label="输出路径"
          value={String(params.output_path || '')}
          onChange={(e) => set('output_path', e.target.value)}
          placeholder="/data/predictions/latest"
        />
        <Input
          label="模型路径 (可选)"
          value={String(params.model_path || '')}
          onChange={(e) => set('model_path', e.target.value)}
          placeholder="/opt/spark-apps/models/multitask_health_model.pt"
        />
      </div>
    );
  }

  if (jobType === 'custom_hive') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Textarea
          label="Hive SQL / HQL"
          rows={8}
          value={String(params.sql || '')}
          onChange={(e) => set('sql', e.target.value)}
          placeholder="INSERT OVERWRITE TABLE ... SELECT ..."
          style={{ fontFamily: 'monospace', fontSize: 13 }}
        />
        <Select<string>
          label="Hive 数据库"
          value={String(params.database || 'smartmedcare')}
          onChange={(v) => set('database', v)}
          options={[
            { label: 'smartmedcare', value: 'smartmedcare' },
            { label: 'default', value: 'default' },
          ]}
        />
      </div>
    );
  }

  return null;
};

export default JobParamsForm;
