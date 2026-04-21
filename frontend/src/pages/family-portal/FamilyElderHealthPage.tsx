import React, { useCallback, useEffect, useState } from 'react';
import {
  HeartPulse,
  AlertTriangle,
  User,
  Phone,
  Home,
  Activity,
  Droplet,
  Thermometer,
  Gauge,
  Frown,
} from 'lucide-react';
import { Card, CardBody, Chip, Tabs } from '@/components/ui';
import type { ChipTone } from '@/components/ui';
import { getFamilySelf, getFamilyElder, getElderHealthRecords, getElderAlerts } from '../../api/family';
import type { FamilyMemberInfo, FamilyElderInfo } from '../../types/family';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import { formatDateTime } from '../../utils/formatter';
import { message } from '../../utils/message';

interface HealthRecord {
  id: number;
  record_date: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  blood_glucose?: number;
  heart_rate?: number;
  temperature?: number;
  notes?: string;
  created_at: string;
}

interface AlertRecord {
  id: number;
  elder_name: string;
  alert_type: string;
  level: string;
  message: string;
  status: string;
  created_at: string;
}

const alertLevelToneMap: Record<string, ChipTone> = {
  high: 'error',
  medium: 'warning',
  low: 'primary',
};

const alertLevelLabelMap: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

const alertStatusLabelMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

const alertStatusToneMap: Record<string, ChipTone> = {
  pending: 'error',
  processing: 'warning',
  resolved: 'success',
  closed: 'default',
};

/* ---- Vital sign range helpers ---- */

function bpColor(systolic?: number, diastolic?: number): string {
  if (systolic === undefined && diastolic === undefined) return 'inherit';
  if ((systolic && systolic >= 140) || (diastolic && diastolic >= 90)) return '#ef4444';
  if ((systolic && systolic >= 130) || (diastolic && diastolic >= 85)) return '#f59e0b';
  return 'inherit';
}

function glucoseColor(val?: number): string {
  if (val === undefined) return 'inherit';
  if (val >= 7.0) return '#ef4444';
  if (val >= 6.1) return '#f59e0b';
  return 'inherit';
}

function heartRateColor(val?: number): string {
  if (val === undefined) return 'inherit';
  if (val > 100 || val < 60) return '#ef4444';
  if (val > 90 || val < 65) return '#f59e0b';
  return 'inherit';
}

function temperatureColor(val?: number): string {
  if (val === undefined) return 'inherit';
  if (val >= 37.3) return '#ef4444';
  if (val >= 37.0) return '#f59e0b';
  return 'inherit';
}

function vitalIndicatorColor(val: number | undefined, colorFn: (v?: number) => string): string {
  return colorFn(val);
}

/* ---- Vital sign card ---- */

function VitalCard({
  icon,
  label,
  value,
  unit,
  color,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
  loading?: boolean;
}) {
  const isAlert = color === '#ef4444';
  const isBorderline = color === '#f59e0b';
  const borderColor = isAlert ? '#fecaca' : isBorderline ? '#fde68a' : 'var(--smc-divider)';
  const bgColor = isAlert ? '#fef2f2' : isBorderline ? '#fffbeb' : 'var(--smc-surface)';

  return (
    <Card
      style={{
        height: '100%',
        border: `1px solid ${borderColor}`,
        background: bgColor,
      }}
    >
      <div style={{ padding: '16px 20px' }}>
        {loading ? (
          <>
            <div className="smc-skel" style={{ width: 80, height: 20 }} />
            <div className="smc-skel" style={{ width: 60, height: 36, marginTop: 4 }} />
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  color: color === 'inherit' ? 'var(--smc-text-2)' : color,
                  display: 'inline-flex',
                }}
              >
                {icon}
              </span>
              <span style={{ fontSize: 13, color: 'var(--smc-text-2)' }}>{label}</span>
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: color === 'inherit' ? 'var(--smc-text-1)' : color,
              }}
            >
              {value}
              <span style={{ fontSize: 13, color: 'var(--smc-text-2)', marginLeft: 4, fontWeight: 400 }}>
                {unit}
              </span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/* ---- Column definitions ---- */

const healthColumns: AppTableColumn<HealthRecord>[] = [
  {
    title: '记录日期',
    dataIndex: 'record_date',
    key: 'record_date',
    width: 120,
  },
  {
    title: '收缩压 (mmHg)',
    dataIndex: 'systolic_bp',
    key: 'systolic_bp',
    width: 130,
    render: (value, record) => {
      if (typeof value !== 'number') return '-';
      const color = bpColor(value, record.diastolic_bp);
      return (
        <span style={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</span>
      );
    },
  },
  {
    title: '舒张压 (mmHg)',
    dataIndex: 'diastolic_bp',
    key: 'diastolic_bp',
    width: 130,
    render: (value, record) => {
      if (typeof value !== 'number') return '-';
      const color = bpColor(record.systolic_bp, value);
      return (
        <span style={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</span>
      );
    },
  },
  {
    title: '血糖 (mmol/L)',
    dataIndex: 'blood_glucose',
    key: 'blood_glucose',
    width: 130,
    render: (value) => {
      if (typeof value !== 'number') return '-';
      const color = glucoseColor(value);
      return (
        <span style={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</span>
      );
    },
  },
  {
    title: '心率 (bpm)',
    dataIndex: 'heart_rate',
    key: 'heart_rate',
    width: 110,
    render: (value) => {
      if (typeof value !== 'number') return '-';
      const color = heartRateColor(value);
      return (
        <span style={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</span>
      );
    },
  },
  {
    title: '体温 (°C)',
    dataIndex: 'temperature',
    key: 'temperature',
    width: 100,
    render: (value) => {
      if (typeof value !== 'number') return '-';
      const color = temperatureColor(value);
      return (
        <span style={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</span>
      );
    },
  },
  {
    title: '备注',
    dataIndex: 'notes',
    key: 'notes',
    ellipsis: true,
    render: (value) => (typeof value === 'string' && value ? value : '-'),
  },
];

const alertColumns: AppTableColumn<AlertRecord>[] = [
  {
    title: '预警类型',
    dataIndex: 'alert_type',
    key: 'alert_type',
    width: 120,
  },
  {
    title: '级别',
    dataIndex: 'level',
    key: 'level',
    width: 100,
    render: (value) => {
      const level = typeof value === 'string' ? value : '';
      return (
        <Chip tone={alertLevelToneMap[level] || 'primary'} style={{ fontWeight: 600 }}>
          {alertLevelLabelMap[level] || level || '-'}
        </Chip>
      );
    },
  },
  {
    title: '内容',
    dataIndex: 'message',
    key: 'message',
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 110,
    render: (value) => {
      const status = typeof value === 'string' ? value : '';
      return (
        <Chip
          tone={alertStatusToneMap[status] || 'default'}
          outlined
          style={{ fontWeight: 500 }}
        >
          {alertStatusLabelMap[status] || status || '-'}
        </Chip>
      );
    },
  },
  {
    title: '时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
    render: (value) => formatDateTime(value as string | undefined),
  },
];

/* ---- Main component ---- */

const FamilyElderHealthPage: React.FC = () => {
  const [familyInfo, setFamilyInfo] = useState<FamilyMemberInfo | null>(null);
  const [elderInfo, setElderInfo] = useState<FamilyElderInfo | null>(null);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [healthTotal, setHealthTotal] = useState(0);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [healthPage, setHealthPage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);
  const [tab, setTab] = useState<'health' | 'alerts'>('health');
  const pageSize = 30;

  /* Latest record for vital cards */
  const latestRecord = healthRecords.length > 0 ? healthRecords[0] : null;

  useEffect(() => {
    const fetchBaseData = async () => {
      setLoading(true);
      try {
        const [selfRes, elderRes] = await Promise.all([getFamilySelf(), getFamilyElder()]);
        setFamilyInfo(selfRes.data as FamilyMemberInfo);
        setElderInfo(elderRes.data as FamilyElderInfo);
      } catch {
        message.error('获取信息失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchBaseData();
  }, []);

  const fetchHealthRecords = useCallback(
    async (page: number) => {
      if (!familyInfo) return;
      setHealthLoading(true);
      try {
        const res = await getElderHealthRecords(familyInfo.elder_id, {
          page,
          page_size: pageSize,
        });
        const data = res.data as { items: HealthRecord[]; total: number };
        setHealthRecords(data.items || []);
        setHealthTotal(data.total || 0);
      } catch {
        message.error('获取健康记录失败');
      } finally {
        setHealthLoading(false);
      }
    },
    [familyInfo],
  );

  const fetchAlerts = useCallback(
    async (page: number) => {
      if (!familyInfo) return;
      setAlertsLoading(true);
      try {
        const res = await getElderAlerts({
          elder_id: familyInfo.elder_id,
          page,
          page_size: pageSize,
        });
        const data = res.data as { items: AlertRecord[]; total: number };
        setAlerts(data.items || []);
        setAlertsTotal(data.total || 0);
      } catch {
        message.error('获取预警信息失败');
      } finally {
        setAlertsLoading(false);
      }
    },
    [familyInfo],
  );

  useEffect(() => {
    if (familyInfo) {
      void fetchHealthRecords(healthPage);
    }
  }, [familyInfo, healthPage, fetchHealthRecords]);

  useEffect(() => {
    if (familyInfo) {
      void fetchAlerts(alertsPage);
    }
  }, [familyInfo, alertsPage, fetchAlerts]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="smc-skel" style={{ height: 100, borderRadius: 24 }} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="smc-skel" style={{ height: 90, borderRadius: 24 }} />
          ))}
        </div>
        <div className="smc-skel" style={{ height: 400, borderRadius: 24 }} />
      </div>
    );
  }

  const healthTable = (
    <AppTable<HealthRecord>
      columns={healthColumns}
      dataSource={healthRecords}
      loading={healthLoading}
      rowKey="id"
      pagination={{
        current: healthPage,
        pageSize,
        total: healthTotal,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
      }}
      onChange={({ current }) => {
        if (current) setHealthPage(current);
      }}
      emptyText="暂无健康记录"
    />
  );

  const alertsContent =
    !alertsLoading && alerts.length === 0 ? (
      <div
        style={{
          padding: '64px 0',
          textAlign: 'center',
          borderRadius: 24,
          background: 'var(--smc-bg-2, #f8fafc)',
        }}
      >
        <Frown size={48} color="var(--smc-text-3)" style={{ marginBottom: 12 }} />
        <div style={{ color: 'var(--smc-text-2)', fontSize: 15 }}>暂无风险预警</div>
        <div style={{ color: 'var(--smc-text-3)', fontSize: 13, marginTop: 4 }}>
          当老人健康指标异常时，系统会自动生成预警
        </div>
      </div>
    ) : (
      <AppTable<AlertRecord>
        columns={alertColumns}
        dataSource={alerts}
        loading={alertsLoading}
        rowKey="id"
        pagination={{
          current: alertsPage,
          pageSize,
          total: alertsTotal,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={({ current }) => {
          if (current) setAlertsPage(current);
        }}
        emptyText="暂无风险预警"
      />
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Elder info header */}
      {elderInfo && (
        <Card
          style={{
            background: 'linear-gradient(135deg, #667eea08 0%, #764ba208 100%)',
          }}
        >
          <div style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: 24,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <HeartPulse size={20} color="var(--smc-error)" />
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {elderInfo.name} 的健康信息
                </h3>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  gap: 24,
                  flexWrap: 'wrap',
                  flex: 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} color="var(--smc-text-2)" />
                  <span style={{ fontSize: 14 }}>{elderInfo.gender}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Phone size={16} color="var(--smc-text-2)" />
                  <span style={{ fontSize: 14 }}>{elderInfo.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Home size={16} color="var(--smc-text-2)" />
                  <span
                    style={{
                      fontSize: 14,
                      maxWidth: 240,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {elderInfo.address}
                  </span>
                </div>
              </div>

              {elderInfo.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {elderInfo.tags.map((tag) => (
                    <Chip key={tag} tone="primary" style={{ fontWeight: 600 }}>
                      {tag}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Vital sign summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        <VitalCard
          icon={<Gauge size={16} />}
          label="血压"
          value={
            latestRecord?.systolic_bp !== undefined && latestRecord?.diastolic_bp !== undefined
              ? `${latestRecord.systolic_bp}/${latestRecord.diastolic_bp}`
              : '-'
          }
          unit="mmHg"
          color={vitalIndicatorColor(latestRecord?.systolic_bp, (v) => bpColor(v, latestRecord?.diastolic_bp))}
          loading={healthLoading && healthRecords.length === 0}
        />
        <VitalCard
          icon={<Activity size={16} />}
          label="心率"
          value={latestRecord?.heart_rate !== undefined ? String(latestRecord.heart_rate) : '-'}
          unit="bpm"
          color={vitalIndicatorColor(latestRecord?.heart_rate, heartRateColor)}
          loading={healthLoading && healthRecords.length === 0}
        />
        <VitalCard
          icon={<Droplet size={16} />}
          label="血糖"
          value={latestRecord?.blood_glucose !== undefined ? String(latestRecord.blood_glucose) : '-'}
          unit="mmol/L"
          color={vitalIndicatorColor(latestRecord?.blood_glucose, glucoseColor)}
          loading={healthLoading && healthRecords.length === 0}
        />
        <VitalCard
          icon={<Thermometer size={16} />}
          label="体温"
          value={latestRecord?.temperature !== undefined ? String(latestRecord.temperature) : '-'}
          unit="°C"
          color={vitalIndicatorColor(latestRecord?.temperature, temperatureColor)}
          loading={healthLoading && healthRecords.length === 0}
        />
      </div>

      {/* Tabs section */}
      <Card>
        <CardBody>
          <Tabs
            activeKey={tab}
            onChange={(key) => setTab(key as 'health' | 'alerts')}
            items={[
              {
                key: 'health',
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <HeartPulse size={16} />
                    {`健康记录${healthTotal > 0 ? ` (${healthTotal})` : ''}`}
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: 16 }}>{healthTable}</div>
                ),
              },
              {
                key: 'alerts',
                label: (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={16} />
                    {`风险预警${alertsTotal > 0 ? ` (${alertsTotal})` : ''}`}
                  </span>
                ),
                children: <div style={{ paddingTop: 16 }}>{alertsContent}</div>,
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
};

export default FamilyElderHealthPage;
