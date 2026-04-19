import React from 'react';
import { Activity, Droplet, Droplets, Clock } from 'lucide-react';
import { Card, CardBody, Spinner } from '@/components/ui';
import { formatDateTime } from '@/utils/formatter';

export interface HealthStatusData {
  bloodPressure: string;
  heartRate: string;
  bloodGlucose: string;
  lastRecordAt?: string | null;
}

interface MetricProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  status?: 'normal' | 'warn' | 'unknown';
}

function classifyBP(bp: string): 'normal' | 'warn' | 'unknown' {
  if (bp === '--') return 'unknown';
  const m = bp.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return 'unknown';
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  if (sys >= 140 || dia >= 90 || sys < 90 || dia < 60) return 'warn';
  return 'normal';
}

function classifyHR(hr: string): 'normal' | 'warn' | 'unknown' {
  if (hr === '--') return 'unknown';
  const n = Number(hr);
  if (Number.isNaN(n)) return 'unknown';
  if (n < 60 || n > 100) return 'warn';
  return 'normal';
}

function classifyGlucose(g: string): 'normal' | 'warn' | 'unknown' {
  if (g === '--') return 'unknown';
  const n = Number(g);
  if (Number.isNaN(n)) return 'unknown';
  if (n < 3.9 || n > 7.8) return 'warn';
  return 'normal';
}

const STATUS_LABEL: Record<string, string> = {
  normal: '正常',
  warn: '需关注',
  unknown: '暂无数据',
};

const STATUS_COLOR: Record<string, string> = {
  normal: '#16a34a',
  warn: '#f59e0b',
  unknown: '#94a3b8',
};

function Metric({ label, value, unit, icon, color, status = 'unknown' }: MetricProps) {
  const statusColor = STATUS_COLOR[status];
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '20px 18px',
        borderRadius: 14,
        background: 'var(--smc-surface-alt)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${color}1f`,
            color,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 16, color: 'var(--smc-text-2)' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--smc-text)', lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: 14, color: 'var(--smc-text-2)' }}>{unit}</span>
      </div>
      <span
        style={{
          alignSelf: 'flex-start',
          fontSize: 13,
          fontWeight: 600,
          padding: '2px 10px',
          borderRadius: 999,
          background: `${statusColor}1a`,
          color: statusColor,
        }}
      >
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}

interface HealthStatusCardProps {
  data: HealthStatusData;
  loading?: boolean;
}

const HealthStatusCard: React.FC<HealthStatusCardProps> = ({ data, loading }) => {
  return (
    <Card style={{ borderRadius: 18, height: '100%' }}>
      <CardBody style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={22} style={{ color: '#ef5350' }} />
            <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--smc-text)' }}>
              今日健康状态
            </span>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--smc-text-2)',
            }}
          >
            <Clock size={14} />
            {data.lastRecordAt ? formatDateTime(data.lastRecordAt) : '暂无记录'}
          </span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spinner />
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <Metric
              label="血压"
              value={data.bloodPressure}
              unit="mmHg"
              icon={<Droplet size={20} />}
              color="#ef5350"
              status={classifyBP(data.bloodPressure)}
            />
            <Metric
              label="心率"
              value={data.heartRate}
              unit="bpm"
              icon={<Activity size={20} />}
              color="#ec407a"
              status={classifyHR(data.heartRate)}
            />
            <Metric
              label="血糖"
              value={data.bloodGlucose}
              unit="mmol/L"
              icon={<Droplets size={20} />}
              color="#ab47bc"
              status={classifyGlucose(data.bloodGlucose)}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default HealthStatusCard;
