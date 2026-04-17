import React, { useCallback, useState } from 'react';
import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ManageSearchRoundedIcon from '@mui/icons-material/ManageSearchRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { useNavigate } from 'react-router-dom';
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
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
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
    if (!window.confirm(`确认将该预警标记为${formatAlertStatus(status)}？`)) {
      return;
    }

    try {
      await updateAlertStatus(id, { status });
      message.success('状态更新成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleBatchStatus = async (status: 'resolved' | 'ignored') => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要处理的预警');
      return;
    }

    if (!window.confirm(`确认将选中的预警批量标记为${formatAlertStatus(status)}？`)) {
      return;
    }

    try {
      await batchUpdateAlertStatus({
        ids: selectedRowKeys as number[],
        status,
        remark: status === 'resolved' ? '批量处理' : '批量忽略',
      });
      message.success('批量操作成功');
      setSelectedRowKeys([]);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

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
            size="small"
            label={SOURCE_LABELS[source] || source || '-'}
            sx={{
              color: SOURCE_COLORS[source] || 'text.primary',
              borderColor: SOURCE_COLORS[source] || 'divider',
              bgcolor: 'transparent',
            }}
            variant="outlined"
          />
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
            size="small"
            label={formatRiskLevel(riskLevel)}
            sx={{
              color: RISK_LEVEL_COLORS[riskLevel] || 'text.primary',
              borderColor: RISK_LEVEL_COLORS[riskLevel] || 'divider',
              bgcolor: 'transparent',
            }}
            variant="outlined"
          />
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
            size="small"
            label={formatAlertStatus(alertStatus)}
            sx={{
              color: ALERT_STATUS_COLORS[alertStatus] || 'text.primary',
              borderColor: ALERT_STATUS_COLORS[alertStatus] || 'divider',
              bgcolor: 'transparent',
            }}
            variant="outlined"
          />
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
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <Button
            size="small"
            startIcon={<VisibilityRoundedIcon />}
            onClick={() => navigate(`/alerts/${record.id}`)}
          >
            详情
          </Button>
          <PermissionGuard permission="alert:update">
            {record.status === 'pending' && (
              <Button
                size="small"
                color="primary"
                startIcon={<ManageSearchRoundedIcon />}
                onClick={() => handleStatusUpdate(record.id, 'processing')}
              >
                处理
              </Button>
            )}
            {record.status === 'processing' && (
              <Button
                size="small"
                color="success"
                startIcon={<TaskAltRoundedIcon />}
                onClick={() => handleStatusUpdate(record.id, 'resolved')}
              >
                解决
              </Button>
            )}
            {(record.status === 'pending' || record.status === 'processing') && (
              <Button
                size="small"
                color="inherit"
                startIcon={<BlockRoundedIcon />}
                onClick={() => handleStatusUpdate(record.id, 'ignored')}
              >
                忽略
              </Button>
            )}
          </PermissionGuard>
        </Stack>
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>状态</InputLabel>
              <Select
                label="状态"
                value={query.status || ''}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, status: event.target.value || undefined }))
                }
              >
                <MenuItem value="">全部</MenuItem>
                {ALERT_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>风险等级</InputLabel>
              <Select
                label="风险等级"
                value={query.risk_level || ''}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, risk_level: event.target.value || undefined }))
                }
              >
                <MenuItem value="">全部</MenuItem>
                {RISK_LEVEL_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>来源</InputLabel>
              <Select
                label="来源"
                value={query.source || ''}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, source: event.target.value || undefined }))
                }
              >
                <MenuItem value="">全部</MenuItem>
                <MenuItem value="manual">人工</MenuItem>
                <MenuItem value="ml">AI</MenuItem>
                <MenuItem value="rule">规则</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="开始日期"
              type="date"
              size="small"
              value={query.date_start || ''}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, date_start: event.target.value || undefined }))
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="结束日期"
              type="date"
              size="small"
              value={query.date_end || ''}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, date_end: event.target.value || undefined }))
              }
              InputLabelProps={{ shrink: true }}
            />
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
              <Button
                variant="contained"
                startIcon={<AddRoundedIcon />}
                onClick={() => setFormVisible(true)}
              >
                手动创建
              </Button>
            </PermissionGuard>
          </Stack>
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
