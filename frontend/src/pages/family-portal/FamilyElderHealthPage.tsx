import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import BloodtypeRoundedIcon from '@mui/icons-material/BloodtypeRounded';
import DeviceThermostatRoundedIcon from '@mui/icons-material/DeviceThermostatRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import SentimentDissatisfiedRoundedIcon from '@mui/icons-material/SentimentDissatisfiedRounded';
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

const alertLevelColorMap: Record<string, 'error' | 'warning' | 'primary'> = {
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

const alertStatusColorMap: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
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

  return (
    <Card
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: isAlert ? '#fecaca' : isBorderline ? '#fde68a' : 'divider',
        bgcolor: isAlert ? '#fef2f2' : isBorderline ? '#fffbeb' : 'background.paper',
      }}
    >
      <CardContent sx={{ py: 2, px: 2.5 }}>
        {loading ? (
          <>
            <Skeleton width={80} height={20} />
            <Skeleton width={60} height={36} sx={{ mt: 0.5 }} />
          </>
        ) : (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Box sx={{ color: color === 'inherit' ? 'text.secondary' : color, display: 'flex' }}>
                {icon}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {label}
              </Typography>
            </Stack>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: color === 'inherit' ? 'text.primary' : color,
              }}
            >
              {value}
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                {unit}
              </Typography>
            </Typography>
          </>
        )}
      </CardContent>
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
      return <Typography variant="body2" sx={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</Typography>;
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
      return <Typography variant="body2" sx={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</Typography>;
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
      return <Typography variant="body2" sx={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</Typography>;
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
      return <Typography variant="body2" sx={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</Typography>;
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
      return <Typography variant="body2" sx={{ fontWeight: color !== 'inherit' ? 700 : 400, color }}>{value}</Typography>;
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
        <Chip
          size="small"
          color={alertLevelColorMap[level] || 'primary'}
          variant="filled"
          label={alertLevelLabelMap[level] || level || '-'}
          sx={{ fontWeight: 600 }}
        />
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
          size="small"
          variant="outlined"
          color={alertStatusColorMap[status] || 'default'}
          label={alertStatusLabelMap[status] || status || '-'}
          sx={{ fontWeight: 500 }}
        />
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
  const pageSize = 10;

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
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={100} sx={{ borderRadius: 3 }} />
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={90} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Elder info header */}
      {elderInfo && (
        <Card
          sx={{
            background: 'linear-gradient(135deg, #667eea08 0%, #764ba208 100%)',
          }}
        >
          <CardContent sx={{ py: 2.5 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              alignItems={{ md: 'center' }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                <FavoriteRoundedIcon color="error" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {elderInfo.name} 的健康信息
                </Typography>
              </Stack>

              <Stack
                direction="row"
                spacing={3}
                useFlexGap
                flexWrap="wrap"
                sx={{ flex: 1 }}
                divider={<Box sx={{ width: '1px', bgcolor: 'divider', alignSelf: 'stretch' }} />}
              >
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <PersonRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2">{elderInfo.gender}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <PhoneRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2">{elderInfo.phone}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <HomeRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {elderInfo.address}
                  </Typography>
                </Stack>
              </Stack>

              {elderInfo.tags.length > 0 && (
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                  {elderInfo.tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: 'primary.main',
                        color: '#fff',
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Vital sign summary cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        <VitalCard
          icon={<SpeedRoundedIcon fontSize="small" />}
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
          icon={<MonitorHeartRoundedIcon fontSize="small" />}
          label="心率"
          value={latestRecord?.heart_rate !== undefined ? String(latestRecord.heart_rate) : '-'}
          unit="bpm"
          color={vitalIndicatorColor(latestRecord?.heart_rate, heartRateColor)}
          loading={healthLoading && healthRecords.length === 0}
        />
        <VitalCard
          icon={<BloodtypeRoundedIcon fontSize="small" />}
          label="血糖"
          value={latestRecord?.blood_glucose !== undefined ? String(latestRecord.blood_glucose) : '-'}
          unit="mmol/L"
          color={vitalIndicatorColor(latestRecord?.blood_glucose, glucoseColor)}
          loading={healthLoading && healthRecords.length === 0}
        />
        <VitalCard
          icon={<DeviceThermostatRoundedIcon fontSize="small" />}
          label="体温"
          value={latestRecord?.temperature !== undefined ? String(latestRecord.temperature) : '-'}
          unit="°C"
          color={vitalIndicatorColor(latestRecord?.temperature, temperatureColor)}
          loading={healthLoading && healthRecords.length === 0}
        />
      </Box>

      {/* Tabs section */}
      <Card>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, nextValue) => setTab(nextValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              mb: 2,
              '& .MuiTab-root': {
                fontWeight: 600,
                minHeight: 48,
              },
            }}
          >
            <Tab
              value="health"
              icon={<FavoriteRoundedIcon fontSize="small" />}
              iconPosition="start"
              label={`健康记录${healthTotal > 0 ? ` (${healthTotal})` : ''}`}
            />
            <Tab
              value="alerts"
              icon={<WarningAmberRoundedIcon fontSize="small" />}
              iconPosition="start"
              label={`风险预警${alertsTotal > 0 ? ` (${alertsTotal})` : ''}`}
            />
          </Tabs>

          <Box
            sx={{
              borderRadius: 2,
              bgcolor: tab === 'alerts' ? '#fef2f208' : '#f0fdf408',
              p: { xs: 0, sm: 0.5 },
            }}
          >
            {tab === 'health' ? (
              <AppTable<HealthRecord>
                columns={healthColumns}
                dataSource={healthRecords}
                loading={healthLoading}
                rowKey="id"
                pagination={{
                  current: healthPage,
                  pageSize,
                  total: healthTotal,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                onChange={({ current }) => {
                  if (current) setHealthPage(current);
                }}
                emptyText="暂无健康记录"
              />
            ) : (
              <>
                {!alertsLoading && alerts.length === 0 ? (
                  <Box
                    sx={{
                      py: 8,
                      textAlign: 'center',
                      borderRadius: 3,
                      bgcolor: 'background.default',
                    }}
                  >
                    <SentimentDissatisfiedRoundedIcon
                      sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }}
                    />
                    <Typography color="text.secondary" variant="body1">
                      暂无风险预警
                    </Typography>
                    <Typography color="text.disabled" variant="body2" sx={{ mt: 0.5 }}>
                      当老人健康指标异常时，系统会自动生成预警
                    </Typography>
                  </Box>
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
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    onChange={({ current }) => {
                      if (current) setAlertsPage(current);
                    }}
                    emptyText="暂无风险预警"
                  />
                )}
              </>
            )}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default FamilyElderHealthPage;
