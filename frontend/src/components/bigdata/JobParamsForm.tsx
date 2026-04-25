import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Input } from '@/components/ui';
import type { JobType } from '../../types/bigdata';

interface Props {
  jobType: JobType;
  params: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

const DEFAULT_MODEL_PATH = '/opt/spark-apps/models/multitask_health_model.pt';

const InfoPanel: React.FC<{ title: string; lines: string[] }> = ({ title, lines }) => (
  <div
    style={{
      display: 'flex',
      gap: 10,
      padding: 14,
      borderRadius: 10,
      background: 'color-mix(in oklab, var(--smc-primary) 8%, transparent)',
      border: '1px solid color-mix(in oklab, var(--smc-primary) 22%, transparent)',
    }}
  >
    <Info size={18} color="var(--smc-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
    <div style={{ minWidth: 0, lineHeight: 1.6 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--smc-text)' }}>{title}</div>
      <ul
        style={{
          margin: '6px 0 0',
          paddingLeft: 18,
          fontSize: 12,
          color: 'var(--smc-text-2)',
        }}
      >
        {lines.map((line, i) => (
          <li key={i} style={{ marginTop: i === 0 ? 0 : 4 }}>
            {line}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const JobParamsForm: React.FC<Props> = ({ jobType, params, onChange }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const set = (key: string, value: unknown) => {
    onChange({ ...params, [key]: value });
  };

  if (jobType === 'mysql_to_hdfs') {
    return (
      <InfoPanel
        title="业务库快照（MySQL → HDFS）"
        lines={[
          '将 elders、health_records、medical_records、alerts、followups、interventions 六张业务表完整导出到 HDFS。',
          '输出路径：/warehouse/raw/<table>/dt=<今天>/（Parquet / Snappy 压缩）',
          '此作业按系统默认配置运行，无需输入任何参数。点击"提交"即可。',
        ]}
      />
    );
  }

  if (jobType === 'build_marts') {
    return (
      <InfoPanel
        title="构建统计数据集市"
        lines={[
          '基于最新的 HDFS 快照，刷新所有集市宽表：mart_elder_risk_summary、mart_daily_alerts、mart_intervention_effectiveness、mart_followup_completion。',
          '依赖：需要先跑过"业务库快照"，否则会读不到 dt=<今天> 分区。',
          '此作业无参数。点击"提交"即可。',
        ]}
      />
    );
  }

  if (jobType === 'batch_predict') {
    const modelPath = String(params.model_path || '');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <InfoPanel
          title="智能风险预测（批量）"
          lines={[
            '对全量老人运行多任务健康风险模型，产出高风险概率、随访必要性、综合健康分。',
            '依赖：需要先跑过"业务库快照"（读取 raw_elders / raw_health_records）。',
            '默认使用内置模型，无需输入任何参数。如需换模型，展开下方"高级设置"。',
          ]}
        />
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--smc-text-2)',
            cursor: 'pointer',
            fontSize: 12,
            padding: 0,
            alignSelf: 'flex-start',
          }}
        >
          {advancedOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          高级设置
        </button>
        {advancedOpen && (
          <Input
            label="模型路径"
            value={modelPath}
            onChange={(e) => set('model_path', e.target.value)}
            placeholder={DEFAULT_MODEL_PATH}
            helperText={`留空使用默认：${DEFAULT_MODEL_PATH}`}
          />
        )}
      </div>
    );
  }

  return null;
};

export default JobParamsForm;
