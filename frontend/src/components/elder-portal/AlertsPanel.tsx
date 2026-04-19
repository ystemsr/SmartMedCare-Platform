import React from 'react';
import { Bell, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardBody, Chip, Spinner } from '@/components/ui';
import type { ChipTone } from '@/components/ui';
import { formatDateTime } from '../../utils/formatter';
import type { Alert as AlertEntity } from '../../types/alert';

interface AlertsPanelProps {
  alerts: AlertEntity[];
  loading?: boolean;
  failed?: boolean;
}

interface RiskTone {
  label: string;
  color: string;
  bg: string;
  border: string;
  chipTone: ChipTone;
}

const RISK_TONE: Record<AlertEntity['risk_level'], RiskTone> = {
  critical: { label: '紧急', color: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', chipTone: 'error' },
  high:     { label: '高风险', color: '#9a3412', bg: '#ffedd5', border: '#fdba74', chipTone: 'error' },
  medium:   { label: '中等', color: '#854d0e', bg: '#fef3c7', border: '#fcd34d', chipTone: 'warning' },
  low:      { label: '提示', color: '#3f6212', bg: '#ecfccb', border: '#bef264', chipTone: 'info' },
};

function AlertCard({ alert }: { alert: AlertEntity }) {
  const tone = RISK_TONE[alert.risk_level] ?? RISK_TONE.medium;
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 14,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#fff',
          color: tone.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#3f2d1f' }}>
            {alert.title || alert.type || '健康预警'}
          </div>
          <Chip tone={tone.chipTone}>{tone.label}</Chip>
        </div>
        {alert.description && (
          <div style={{ fontSize: 15, color: '#5b4636', marginBottom: 6, lineHeight: 1.6 }}>
            {alert.description}
          </div>
        )}
        <div style={{ fontSize: 13, color: '#7a6a55' }}>
          触发时间：{formatDateTime(alert.triggered_at)}
        </div>
      </div>
    </div>
  );
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts, loading, failed }) => {
  const hasAlerts = alerts.length > 0;

  return (
    <Card style={{ borderRadius: 18 }}>
      <CardBody style={{ padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff7ed',
              color: '#c2410c',
            }}
          >
            <Bell size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--smc-text)' }}>
              当前预警
            </div>
            <div style={{ fontSize: 14, color: 'var(--smc-text-2)', marginTop: 2 }}>
              系统根据您的健康数据自动识别的待处理预警
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Spinner />
          </div>
        ) : failed ? (
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#854d0e',
              fontSize: 15,
            }}
          >
            暂无预警信息可显示
          </div>
        ) : hasAlerts ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <CheckCircle2 size={32} style={{ color: '#047857', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#065f46' }}>
                目前一切正常
              </div>
              <div style={{ fontSize: 14, color: '#047857', marginTop: 2 }}>
                暂无需要关注的健康预警，请继续保持良好的生活习惯。
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default AlertsPanel;
