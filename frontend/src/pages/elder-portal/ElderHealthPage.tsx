import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import MonitorHeartRoundedIcon from '@mui/icons-material/MonitorHeartRounded';
import { useAuthStore } from '../../store/auth';
import { getElderHealthRecords } from '../../api/elderPortal';
import AppTable, { type AppTableColumn, type AppTablePagination } from '../../components/AppTable';
import { formatDate, formatDateTime } from '../../utils/formatter';

interface HealthRecord {
  id: number;
  record_date: string;
  record_type: string;
  summary: string;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  blood_glucose?: number;
  created_at: string;
}

const ElderHealthPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const elderId = user?.elder_id;

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<AppTablePagination>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
  });

  useEffect(() => {
    if (!elderId) return;

    const fetchRecords = async () => {
      setLoading(true);
      try {
        const res = await getElderHealthRecords(elderId, {
          page: pagination.current,
          page_size: pagination.pageSize,
        });
        setRecords(res.data?.items || []);
        setPagination((prev) => ({ ...prev, total: res.data?.total || 0 }));
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取健康记录失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchRecords();
  }, [elderId, pagination.current, pagination.pageSize]);

  const columns = useMemo<AppTableColumn<HealthRecord>[]>(() => [
    {
      title: '记录日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 120,
      render: (value) => formatDate(value as string | undefined),
    },
    {
      title: '类型',
      dataIndex: 'record_type',
      key: 'record_type',
      width: 120,
    },
    {
      title: '血压',
      dataIndex: 'blood_pressure_systolic',
      key: 'blood_pressure',
      width: 120,
      render: (_value, record) => {
        if (record.blood_pressure_systolic && record.blood_pressure_diastolic) {
          return `${record.blood_pressure_systolic}/${record.blood_pressure_diastolic} mmHg`;
        }
        return '-';
      },
    },
    {
      title: '心率',
      dataIndex: 'heart_rate',
      key: 'heart_rate',
      width: 100,
      render: (value) => (value != null ? `${value} bpm` : '-'),
    },
    {
      title: '血糖',
      dataIndex: 'blood_glucose',
      key: 'blood_glucose',
      width: 120,
      render: (value) => (value != null ? `${value} mmol/L` : '-'),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value) => formatDateTime(value as string | undefined),
    },
  ], []);

  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current ?? prev.current,
      pageSize: pag.pageSize ?? prev.pageSize,
    }));
  };

  if (!elderId) {
    return (
      <Alert severity="warning" variant="filled">
        未找到关联的老人信息，请联系管理员。
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert severity="error" variant="filled">
        {error}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <MonitorHeartRoundedIcon sx={{ color: '#ec407a' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.15rem' }}>
              我的健康档案
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
            以下是您的所有健康记录，由医护人员定期录入。如有疑问请咨询您的主治医生。
          </Typography>
        </CardContent>
      </Card>

      <AppTable<HealthRecord>
        columns={columns}
        dataSource={records}
        loading={loading}
        rowKey="id"
        pagination={pagination}
        onChange={handleTableChange}
        emptyText="暂无健康记录，请等待医护人员录入"
      />
    </Stack>
  );
};

export default ElderHealthPage;
