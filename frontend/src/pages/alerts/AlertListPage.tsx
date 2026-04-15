import React, { useState, useCallback } from 'react';
import { Button, Tag, Space, Select, DatePicker, Popconfirm, message } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
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
import type { Alert, AlertListQuery } from '../../types/alert';

const { RangePicker } = DatePicker;

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

  const handleStatusUpdate = async (id: number, status: string) => {
    try {
      await updateAlertStatus(id, { status: status as Alert['status'] });
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

  const columns: ColumnsType<Alert> = [
    { title: '预警标题', dataIndex: 'title', width: 200 },
    { title: '类型', dataIndex: 'type', width: 150 },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (level: string) => (
        <Tag color={RISK_LEVEL_COLORS[level]}>{formatRiskLevel(level)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={ALERT_STATUS_COLORS[status]}>{formatAlertStatus(status)}</Tag>
      ),
    },
    { title: '触发时间', dataIndex: 'triggered_at', render: formatDateTime, width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/alerts/${record.id}`)}
          >
            详情
          </Button>
          <PermissionGuard permission="alert:update">
            {record.status === 'pending' && (
              <Popconfirm
                title="确认开始处理？"
                onConfirm={() => handleStatusUpdate(record.id, 'processing')}
              >
                <Button type="link" size="small">处理</Button>
              </Popconfirm>
            )}
            {record.status === 'processing' && (
              <Popconfirm
                title="确认已解决？"
                onConfirm={() => handleStatusUpdate(record.id, 'resolved')}
              >
                <Button type="link" size="small">解决</Button>
              </Popconfirm>
            )}
            {(record.status === 'pending' || record.status === 'processing') && (
              <Popconfirm
                title="确认忽略？"
                onConfirm={() => handleStatusUpdate(record.id, 'ignored')}
              >
                <Button type="link" size="small" danger>忽略</Button>
              </Popconfirm>
            )}
          </PermissionGuard>
        </Space>
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
          <Space wrap>
            <Select
              placeholder="状态"
              allowClear
              options={ALERT_STATUS_OPTIONS}
              style={{ width: 120 }}
              value={query.status || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, status: val }))}
            />
            <Select
              placeholder="风险等级"
              allowClear
              options={RISK_LEVEL_OPTIONS}
              style={{ width: 120 }}
              value={query.risk_level || undefined}
              onChange={(val) => setQuery((prev) => ({ ...prev, risk_level: val }))}
            />
            <RangePicker
              onChange={(dates) => {
                setQuery((prev) => ({
                  ...prev,
                  date_start: dates?.[0]?.format('YYYY-MM-DD') || undefined,
                  date_end: dates?.[1]?.format('YYYY-MM-DD') || undefined,
                }));
              }}
            />
            <PermissionGuard permission="alert:update">
              <Button onClick={() => handleBatchStatus('resolved')}>批量解决</Button>
              <Button onClick={() => handleBatchStatus('ignored')}>批量忽略</Button>
            </PermissionGuard>
            <PermissionGuard permission="alert:update">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormVisible(true)}>
                手动创建
              </Button>
            </PermissionGuard>
          </Space>
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
