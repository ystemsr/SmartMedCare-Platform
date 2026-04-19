import React, { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import dayjs from 'dayjs';
import { Alert, Button, Card, CardBody, DatePicker } from '@/components/ui';
import { useAuthStore } from '../../store/auth';
import {
  getElderAlerts,
  getElderHealthRecords,
} from '../../api/elderPortal';
import AppTable, {
  type AppTableColumn,
  type AppTablePagination,
} from '../../components/AppTable';
import HealthTrendCharts, {
  type TrendRecord,
} from '../../components/elder-portal/HealthTrendCharts';
import AlertsPanel from '../../components/elder-portal/AlertsPanel';
import { formatDate, formatDateTime } from '../../utils/formatter';
import type { Alert as AlertEntity } from '../../types/alert';

interface HealthRecord extends TrendRecord {
  id: number;
  record_type: string;
  summary: string;
  created_at: string;
}

interface ListResponse<T> {
  data?: { items?: T[]; total?: number };
}

// Backend has no single "active" status; treat pending + processing as active.
const ACTIVE_ALERT_STATUSES = ['pending', 'processing'];

const ElderHealthPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const elderId = user?.elder_id;

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [trendRecords, setTrendRecords] = useState<TrendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<AppTablePagination>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
  });
  const [dateStart, setDateStart] = useState<string | null>(null);
  const [dateEnd, setDateEnd] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertEntity[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsFailed, setAlertsFailed] = useState(false);

  // History table records (paginated, optionally filtered).
  useEffect(() => {
    if (!elderId) return;

    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, unknown> = {
          page: pagination.current,
          page_size: pagination.pageSize,
        };
        if (dateStart) params.date_start = dateStart;
        if (dateEnd) params.date_end = dateEnd;
        const res = (await getElderHealthRecords(elderId, params)) as ListResponse<HealthRecord>;
        setRecords(res.data?.items ?? []);
        setPagination((prev) => ({ ...prev, total: res.data?.total ?? 0 }));
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取健康记录失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchRecords();
  }, [elderId, pagination.current, pagination.pageSize, dateStart, dateEnd]);

  // Last-7-day window for the trend charts (independent of table pagination).
  useEffect(() => {
    if (!elderId) return;
    const fetchTrend = async () => {
      try {
        const sevenDaysAgo = dayjs().subtract(6, 'day').startOf('day').format('YYYY-MM-DD');
        const res = (await getElderHealthRecords(elderId, {
          page: 1,
          page_size: 50,
          date_start: sevenDaysAgo,
        })) as ListResponse<TrendRecord>;
        setTrendRecords(res.data?.items ?? []);
      } catch {
        setTrendRecords([]);
      }
    };
    void fetchTrend();
  }, [elderId]);

  // Active alerts. Backend may forbid elder-self access; degrade silently.
  useEffect(() => {
    if (!elderId) return;
    let cancelled = false;
    const fetchAlerts = async () => {
      setAlertsLoading(true);
      setAlertsFailed(false);
      try {
        const collected: AlertEntity[] = [];
        for (const status of ACTIVE_ALERT_STATUSES) {
          const res = (await getElderAlerts({
            elder_id: elderId,
            status,
            page: 1,
            page_size: 20,
          })) as ListResponse<AlertEntity>;
          collected.push(...(res.data?.items ?? []));
        }
        if (!cancelled) {
          const order: Record<AlertEntity['risk_level'], number> = {
            critical: 0, high: 1, medium: 2, low: 3,
          };
          collected.sort((a, b) => {
            const diff = (order[a.risk_level] ?? 9) - (order[b.risk_level] ?? 9);
            if (diff !== 0) return diff;
            return dayjs(b.triggered_at).valueOf() - dayjs(a.triggered_at).valueOf();
          });
          setAlerts(collected);
        }
      } catch {
        if (!cancelled) {
          setAlerts([]);
          setAlertsFailed(true);
        }
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    };
    void fetchAlerts();
    return () => {
      cancelled = true;
    };
  }, [elderId]);

  const columns = useMemo<AppTableColumn<HealthRecord>[]>(
    () => [
      {
        title: '记录日期',
        dataIndex: 'record_date',
        key: 'record_date',
        width: 130,
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
        width: 140,
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
        width: 110,
        render: (value) => (value != null ? `${value} bpm` : '-'),
      },
      {
        title: '血糖',
        dataIndex: 'blood_glucose',
        key: 'blood_glucose',
        width: 130,
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
    ],
    [],
  );

  const handleTableChange = (pag: { current?: number; pageSize?: number }) => {
    setPagination((prev) => ({
      ...prev,
      current: pag.current ?? prev.current,
      pageSize: pag.pageSize ?? prev.pageSize,
    }));
  };

  const handleResetFilter = () => {
    setDateStart(null);
    setDateEnd(null);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  if (!elderId) {
    return (
      <Alert severity="warning" variant="filled">
        未找到关联的老人信息，请联系管理员。
      </Alert>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <HealthTrendCharts records={trendRecords} />

      <AlertsPanel alerts={alerts} loading={alertsLoading} failed={alertsFailed} />

      <Card style={{ borderRadius: 18 }}>
        <CardBody style={{ padding: 28 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fff7ed',
                  color: '#b45309',
                }}
              >
                <History size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--smc-text)' }}>
                  历史健康记录
                </div>
                <div style={{ fontSize: 14, color: 'var(--smc-text-2)', marginTop: 2 }}>
                  按日期范围筛选，由医护人员定期录入
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ minWidth: 160 }}>
                <DatePicker
                  label="起始日期"
                  value={dateStart}
                  onChange={(v) => {
                    setDateStart(v);
                    setPagination((prev) => ({ ...prev, current: 1 }));
                  }}
                  placeholder="选择起始日期"
                  maxDate={dateEnd ?? undefined}
                />
              </div>
              <div style={{ minWidth: 160 }}>
                <DatePicker
                  label="结束日期"
                  value={dateEnd}
                  onChange={(v) => {
                    setDateEnd(v);
                    setPagination((prev) => ({ ...prev, current: 1 }));
                  }}
                  placeholder="选择结束日期"
                  minDate={dateStart ?? undefined}
                />
              </div>
              <Button
                variant="outlined"
                startIcon={<RotateCcw size={16} />}
                onClick={handleResetFilter}
              >
                重置
              </Button>
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 16 }}>
              <Alert severity="error">{error}</Alert>
            </div>
          )}

          <AppTable<HealthRecord>
            columns={columns}
            dataSource={records}
            loading={loading}
            rowKey="id"
            pagination={pagination}
            onChange={handleTableChange}
            emptyText="暂无健康记录，请等待医护人员录入"
          />
        </CardBody>
      </Card>
    </div>
  );
};

export default ElderHealthPage;
