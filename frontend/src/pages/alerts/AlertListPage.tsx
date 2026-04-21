import React, { useCallback, useState } from 'react';
import { Plus, Eye, Search, CheckCircle2, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip, DatePicker, Select, confirm } from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getAlerts,
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

const AlertListPage: React.FC = () => {
  const navigate = useNavigate();
  const [formVisible, setFormVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const fetchFn = useCallback(
    (params: AlertListQuery & { page: number; page_size: number }) => getAlerts(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Alert, AlertListQuery>(fetchFn);

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
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant="text"
            startIcon={<Eye size={14} />}
            onClick={() => navigate(`/alerts/${record.id}`)}
          >
            详情
          </Button>
          <PermissionGuard permission="alert:update">
            {record.status === 'pending' && (
              <Button
                size="sm"
                variant="text"
                startIcon={<Search size={14} />}
                onClick={() => handleStatusUpdate(record.id, 'processing')}
              >
                处理
              </Button>
            )}
            {record.status === 'processing' && (
              <Button
                size="sm"
                variant="text"
                startIcon={<CheckCircle2 size={14} />}
                onClick={() => handleStatusUpdate(record.id, 'resolved')}
              >
                解决
              </Button>
            )}
            {(record.status === 'pending' || record.status === 'processing') && (
              <Button
                size="sm"
                variant="text"
                startIcon={<Ban size={14} />}
                onClick={() => handleStatusUpdate(record.id, 'ignored')}
              >
                忽略
              </Button>
            )}
          </PermissionGuard>
        </div>
      ),
    },
  ];

  return (
    <>
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
    </>
  );
};

export default AlertListPage;
