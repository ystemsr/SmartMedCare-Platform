import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { getFamilySelf, getFamilyElder, getElderHealthRecords, getElderAlerts } from '../../api/family';
import type { FamilyMemberInfo, FamilyElderInfo } from '../../types/family';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import { formatDateTime } from '../../utils/formatter';

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

const alertStatusLabelMap: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

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
    render: (value) => (typeof value === 'number' ? value : '-'),
  },
  {
    title: '舒张压 (mmHg)',
    dataIndex: 'diastolic_bp',
    key: 'diastolic_bp',
    width: 130,
    render: (value) => (typeof value === 'number' ? value : '-'),
  },
  {
    title: '血糖 (mmol/L)',
    dataIndex: 'blood_glucose',
    key: 'blood_glucose',
    width: 130,
    render: (value) => (typeof value === 'number' ? value : '-'),
  },
  {
    title: '心率 (bpm)',
    dataIndex: 'heart_rate',
    key: 'heart_rate',
    width: 110,
    render: (value) => (typeof value === 'number' ? value : '-'),
  },
  {
    title: '体温 (°C)',
    dataIndex: 'temperature',
    key: 'temperature',
    width: 100,
    render: (value) => (typeof value === 'number' ? value : '-'),
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
      return <Chip size="small" color={alertLevelColorMap[level] || 'primary'} label={level || '-'} />;
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
      return alertStatusLabelMap[status] || status || '-';
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

  useEffect(() => {
    const fetchBaseData = async () => {
      setLoading(true);
      try {
        const [selfRes, elderRes] = await Promise.all([getFamilySelf(), getFamilyElder()]);
        setFamilyInfo(selfRes.data as FamilyMemberInfo);
        setElderInfo(elderRes.data as FamilyElderInfo);
      } catch {
        // Error handled by http interceptor
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
        // Error handled by http interceptor
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
        // Error handled by http interceptor
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={44} />
      </Box>
    );
  }

  const tabs = [
    {
      value: 'health',
      label: '健康记录',
      icon: <FavoriteRoundedIcon fontSize="small" />,
    },
    {
      value: 'alerts',
      label: '风险预警',
      icon: <WarningAmberRoundedIcon fontSize="small" />,
    },
  ] as const;

  return (
    <Stack spacing={3}>
      {elderInfo && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <FavoriteRoundedIcon color="error" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {elderInfo.name} 的健康信息
                </Typography>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary">
                    性别
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 600 }}>
                    {elderInfo.gender}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary">
                    联系电话
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 600 }}>
                    {elderInfo.phone}
                  </Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="text.secondary">
                    住址
                  </Typography>
                  <Typography variant="subtitle1" sx={{ mt: 0.5, fontWeight: 600 }}>
                    {elderInfo.address}
                  </Typography>
                </Box>
              </Box>

              {elderInfo.tags.length > 0 && (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {elderInfo.tags.map((tag) => (
                    <Chip key={tag} color="primary" variant="outlined" label={tag} />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Tabs
            value={tab}
            onChange={(_, nextValue) => setTab(nextValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            {tabs.map((item) => (
              <Tab
                key={item.value}
                value={item.value}
                icon={item.icon}
                iconPosition="start"
                label={item.label}
              />
            ))}
          </Tabs>

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
        </CardContent>
      </Card>
    </Stack>
  );
};

export default FamilyElderHealthPage;
