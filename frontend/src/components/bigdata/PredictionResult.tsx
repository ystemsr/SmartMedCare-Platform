import React from 'react';
import { Card, CardBody } from '@/components/ui';
import type { Prediction } from '../../types/bigdata';

interface PredictionResultProps {
  prediction: Prediction;
  title?: string;
  subtitle?: string;
}

function toPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const PredictionResult: React.FC<PredictionResultProps> = ({ prediction, title, subtitle }) => {
  const highRiskColor = prediction.high_risk ? 'var(--smc-error)' : 'var(--smc-success)';
  const followupColor = prediction.followup_needed ? 'var(--smc-warning)' : 'var(--smc-info)';
  const scoreColor =
    prediction.health_score >= 75
      ? 'var(--smc-success)'
      : prediction.health_score >= 50
        ? 'var(--smc-warning)'
        : 'var(--smc-error)';

  return (
    <Card style={{ overflow: 'hidden' }}>
      <div
        style={{
          padding: '20px 24px',
          background:
            'linear-gradient(135deg, var(--smc-primary-50) 0%, var(--smc-secondary-50) 100%)',
          borderBottom: '1px solid var(--smc-divider)',
        }}
      >
        <div style={{ fontSize: 'var(--smc-fs-lg)', fontWeight: 700, color: 'var(--smc-text)' }}>
          {title ?? '预测结果'}
        </div>
        {subtitle && (
          <div style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)', marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>

      <CardBody>
        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <MetricBlock
            label="高风险概率"
            value={toPct(prediction.high_risk_prob)}
            footer={
              <span
                className="smc-chip smc-chip--outlined"
                style={{ color: highRiskColor, borderColor: highRiskColor, fontWeight: 600 }}
              >
                {prediction.high_risk ? '判定：高风险' : '判定：非高风险'}
              </span>
            }
            color={highRiskColor}
          />
          <MetricBlock
            label="需要随访概率"
            value={toPct(prediction.followup_prob)}
            footer={
              <span
                className="smc-chip smc-chip--outlined"
                style={{ color: followupColor, borderColor: followupColor, fontWeight: 600 }}
              >
                {prediction.followup_needed ? '建议：立即随访' : '建议：暂不需要'}
              </span>
            }
            color={followupColor}
          />
          <MetricBlock
            label="综合健康评分"
            value={prediction.health_score.toFixed(1)}
            footer={
              <span style={{ fontSize: 'var(--smc-fs-xs)', color: 'var(--smc-text-2)' }}>
                分值越高代表健康状况越好 (0-100)
              </span>
            }
            color={scoreColor}
          />
        </div>
      </CardBody>
    </Card>
  );
};

interface MetricBlockProps {
  label: string;
  value: string;
  footer: React.ReactNode;
  color: string;
}

const MetricBlock: React.FC<MetricBlockProps> = ({ label, value, footer, color }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 16,
      borderRadius: 'var(--smc-r-lg)',
      background: `color-mix(in oklab, ${color} 8%, transparent)`,
    }}
  >
    <div style={{ fontSize: 'var(--smc-fs-sm)', color: 'var(--smc-text-2)' }}>{label}</div>
    <div style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
    <div>{footer}</div>
  </div>
);

export default PredictionResult;
