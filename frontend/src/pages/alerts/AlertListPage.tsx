import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Eye, Search, CheckCircle2, Ban, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Chip,
  DatePicker,
  Divider,
  Drawer,
  Select,
  Spinner,
  confirm,
} from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getAlerts,
  getAlertDetail,
  createAlert,
  updateAlertStatus,
  batchUpdateAlertStatus,
} from '../../api/alerts';
import { formatDateTime, formatRiskLevel, formatAlertStatus } from '../../utils/formatter';
import {
  RISK_LEVEL_OPTIONS,
  ALERT_STATUS_OPTIONS,
  RISK_LEVEL_COLORS,
  ALERT_STATUS_COLORS,
} from '../../utils/constants';
import { message } from '../../utils/message';
import type { Alert, AlertListQuery } from '../../types/alert';
import { RefPageHead, RefStat, RefGrid } from '../../components/ref';

const createFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人', type: 'elder-picker', required: true, labelField: 'elder_name' },
  { name: 'type', label: '预警类型', required: true },
  { name: 'title', label: '预警标题', required: true },
  { name: 'description', label: '描述', type: 'textarea', required: true },
  {
    name: 'risk_level',
    label: '风险等级',
    type: 'select',
    required: true,
    options: RISK_LEVEL_OPTIONS,
  },
];

const SOURCE_COLORS: Record<string, string> = {
  manual: '#8c8c8c',
  ml: '#722ed1',
  rule: '#1677ff',
};
const SOURCE_LABELS: Record<string, string> = {
  manual: '人工',
  ml: 'AI',
  rule: '规则',
};

function DrawerField({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: 12, color: 'var(--smc-text-2)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{value ?? '-'}</div>
    </div>
  );
}

const AlertListPage: React.FC = () => {
  const navigate = useNavigate();
  const [formVisible, setFormVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [drawerAlertId, setDrawerAlertId] = useState<number | null>(null);
  const [drawerAlert, setDrawerAlert] = useState<Alert | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchFn = useCallback(
    (params: AlertListQuery & { page: number; page_size: number }) => getAlerts(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Alert, AlertListQuery>(fetchFn);

  const loadDrawer = useCallback(async (id: number) => {
    setDrawerLoading(true);
    try {
      const res = await getAlertDetail(id);
      setDrawerAlert(res.data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载预警详情失败');
      setDrawerAlert(null);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (drawerAlertId == null) {
      setDrawerAlert(null);
      return;
    }
    loadDrawer(drawerAlertId);
  }, [drawerAlertId, loadDrawer]);

  const handleStatusUpdate = async (id: number, status: Alert['status']) => {
    const ok = await confirm({
      title: '更新预警状态',
      content: `确认将该预警标记为${formatAlertStatus(status)}？`,
      intent: status === 'ignored' ? 'warning' : 'info',
    });
    if (!ok) return;

    try {
      await updateAlertStatus(id, { status });
      message.success('状态更新成功');
      refresh();
      if (drawerAlertId === id) await loadDrawer(id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleBatchStatus = async (status: 'processing' | 'resolved' | 'ignored') => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要处理的预警');
      return;
    }

    const ok = await confirm({
      title: '批量操作',
      content: `确认将选中的预警批量标记为${formatAlertStatus(status)}？`,
      intent: status === 'ignored' ? 'warning' : 'info',
    });
    if (!ok) return;

    const remarkMap: Record<string, string> = {
      processing: '批量转入处理中',
      resolved: '批量标记为已解决',
      ignored: '批量忽略',
    };

    try {
      await batchUpdateAlertStatus({
        ids: selectedRowKeys as number[],
        status,
        remark: remarkMap[status],
      });
      message.success('批量操作成功');
      setSelectedRowKeys([]);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const columns: AppTableColumn<Alert>[] = [
    { title: '预警标题', dataIndex: 'title', width: 220 },
    { title: '类型', dataIndex: 'type', width: 150 },
    {
      title: '来源',
      dataIndex: 'source',
      width: 100,
      render: (value: unknown) => {
        const source = String(value ?? '');
        return (
          <Chip
            outlined
            style={{
              color: SOURCE_COLORS[source] || 'var(--smc-text)',
              borderColor: SOURCE_COLORS[source] || 'var(--smc-divider)',
            }}
          >
            {SOURCE_LABELS[source] || source || '-'}
          </Chip>
        );
      },
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 110,
      render: (level: unknown) => {
        const riskLevel = String(level ?? '');
        return (
          <Chip
            outlined
            style={{
              color: RISK_LEVEL_COLORS[riskLevel] || 'var(--smc-text)',
              borderColor: RISK_LEVEL_COLORS[riskLevel] || 'var(--smc-divider)',
            }}
          >
            {formatRiskLevel(riskLevel)}
          </Chip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: unknown) => {
        const alertStatus = String(status ?? '');
        return (
          <Chip
            outlined
            style={{
              color: ALERT_STATUS_COLORS[alertStatus] || 'var(--smc-text)',
              borderColor: ALERT_STATUS_COLORS[alertStatus] || 'var(--smc-divider)',
            }}
          >
            {formatAlertStatus(alertStatus)}
          </Chip>
        );
      },
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          size="sm"
          variant="text"
          startIcon={<Eye size={14} />}
          onClick={() => setDrawerAlertId(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const renderDrawerBody = () => {
    if (drawerLoading && !drawerAlert) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Spinner />
        </div>
      );
    }
    if (!drawerAlert) return null;
    const riskColor = RISK_LEVEL_COLORS[drawerAlert.risk_level] || 'var(--smc-text)';
    const statusColor = ALERT_STATUS_COLORS[drawerAlert.status] || 'var(--smc-text)';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip outlined style={{ color: riskColor, borderColor: riskColor }}>
            {formatRiskLevel(drawerAlert.risk_level)}
          </Chip>
          <Chip outlined style={{ color: statusColor, borderColor: statusColor }}>
            {formatAlertStatus(drawerAlert.status)}
          </Chip>
          {drawerAlert.source && (
            <Chip
              outlined
              style={{
                color: SOURCE_COLORS[drawerAlert.source] || 'var(--smc-text)',
                borderColor: SOURCE_COLORS[drawerAlert.source] || 'var(--smc-divider)',
              }}
            >
              {SOURCE_LABELS[drawerAlert.source] || drawerAlert.source}
            </Chip>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gap: 14,
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          <DrawerField label="预警标题" value={drawerAlert.title} fullWidth />
          <DrawerField label="预警类型" value={drawerAlert.type} />
          <DrawerField label="老人" value={drawerAlert.elder_name || `#${drawerAlert.elder_id}`} />
          <DrawerField label="触发时间" value={formatDateTime(drawerAlert.triggered_at)} />
          {drawerAlert.resolved_at && (
            <DrawerField label="解决时间" value={formatDateTime(drawerAlert.resolved_at)} />
          )}
          <DrawerField label="描述" value={drawerAlert.description} fullWidth />
          {drawerAlert.remark && <DrawerField label="备注" value={drawerAlert.remark} fullWidth />}
        </div>

        <Divider />

        <div>
          <div style={{ fontSize: 12, color: 'var(--smc-text-2)', marginBottom: 8 }}>
            处理操作
          </div>
          <PermissionGuard permission="alert:update">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {drawerAlert.status === 'pending' && (
                <Button
                  startIcon={<Search size={14} />}
                  onClick={() => handleStatusUpdate(drawerAlert.id, 'processing')}
                >
                  开始处理
                </Button>
              )}
              {drawerAlert.status === 'processing' && (
                <Button
                  startIcon={<CheckCircle2 size={14} />}
                  onClick={() => handleStatusUpdate(drawerAlert.id, 'resolved')}
                >
                  标记解决
                </Button>
              )}
              {(drawerAlert.status === 'pending' || drawerAlert.status === 'processing') && (
                <Button
                  variant="outlined"
                  startIcon={<Ban size={14} />}
                  onClick={() => handleStatusUpdate(drawerAlert.id, 'ignored')}
                >
                  忽略
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={() => navigate(`/elders/${drawerAlert.elder_id}`)}
              >
                查看老人信息
              </Button>
              <Button
                variant="text"
                startIcon={<ExternalLink size={14} />}
                onClick={() => navigate(`/alerts/${drawerAlert.id}`)}
              >
                查看完整详情页
              </Button>
            </div>
          </PermissionGuard>
        </div>
      </div>
    );
  };

  const pending = data.filter((a) => a.status === 'pending').length;
  const processing = data.filter((a) => a.status === 'processing').length;
  const resolved = data.filter((a) => a.status === 'resolved').length;
  const highRisk = data.filter((a) => a.risk_level === 'high').length;

  return (
    <>
      <RefPageHead
        title="风险预警"
        subtitle={`共 ${pagination.total ?? data.length} 条 · 待处理 ${pending} · 处理中 ${processing} · 今日解决 ${resolved}`}
        actions={
          <PermissionGuard permission="alert:update">
            <Button startIcon={<Plus size={14} />} onClick={() => setFormVisible(true)}>
              手动创建
            </Button>
          </PermissionGuard>
        }
      />

      <RefGrid cols={4} style={{ marginBottom: 16 }}>
        <RefStat
          label="待处理"
          value={pending}
          sub="需要立即响应"
          tone="risk"
          valueColor="var(--smc-error)"
        />
        <RefStat
          label="处理中"
          value={processing}
          sub="医生正在跟进"
          tone="warn"
          valueColor="var(--smc-warning)"
        />
        <RefStat
          label="已解决"
          value={resolved}
          sub="本页已闭环"
          tone="ok"
          valueColor="var(--smc-success)"
        />
        <RefStat
          label="高风险预警"
          value={highRisk}
          sub="重点关注等级"
          tone="risk"
          valueColor="var(--smc-error)"
        />
      </RefGrid>

      <AppTable<Alert>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索预警标题"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        toolbar={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 120 }}>
              <Select
                label="状态"
                value={query.status || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, status: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...ALERT_STATUS_OPTIONS]}
              />
            </div>
            <div style={{ minWidth: 120 }}>
              <Select
                label="风险等级"
                value={query.risk_level || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, risk_level: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...RISK_LEVEL_OPTIONS]}
              />
            </div>
            <div style={{ minWidth: 120 }}>
              <Select
                label="来源"
                value={query.source || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, source: v ? String(v) : undefined }))
                }
                options={[
                  { label: '全部', value: '' },
                  { label: '人工', value: 'manual' },
                  { label: 'AI', value: 'ml' },
                  { label: '规则', value: 'rule' },
                ]}
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <DatePicker
                label="开始日期"
                value={query.date_start || null}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, date_start: v || undefined }))
                }
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <DatePicker
                label="结束日期"
                value={query.date_end || null}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, date_end: v || undefined }))
                }
              />
            </div>
            <Button
              variant="outlined"
              onClick={() => handleBatchStatus('processing')}
              disabled={selectedRowKeys.length === 0}
            >
              批量处理
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleBatchStatus('resolved')}
              disabled={selectedRowKeys.length === 0}
            >
              批量解决
            </Button>
            <Button
              variant="outlined"
              onClick={() => handleBatchStatus('ignored')}
              disabled={selectedRowKeys.length === 0}
            >
              批量忽略
            </Button>
            <PermissionGuard permission="alert:update">
              <Button startIcon={<Plus size={14} />} onClick={() => setFormVisible(true)}>
                手动创建
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <AppForm
        title="手动创建预警"
        visible={formVisible}
        fields={createFields}
        onSubmit={async (values) => {
          await createAlert(values as Parameters<typeof createAlert>[0]);
          message.success('创建成功');
          setFormVisible(false);
          refresh();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Drawer
        open={drawerAlertId != null}
        onClose={() => setDrawerAlertId(null)}
        placement="right"
        width={520}
        title="预警详情"
      >
        {renderDrawerBody()}
      </Drawer>
    </>
  );
};

export default AlertListPage;
