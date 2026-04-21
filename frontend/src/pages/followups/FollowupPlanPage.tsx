import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Play,
  FilePlus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Chip,
  DatePicker,
  Modal,
  Select,
  Tabs,
  Textarea,
  confirm,
} from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getFollowups,
  createFollowup,
  updateFollowup,
  updateFollowupStatus,
  addFollowupRecord,
  deleteFollowup,
} from '../../api/followups';
import { formatDateTime, formatFollowupStatus, formatPlanType } from '../../utils/formatter';
import {
  FOLLOWUP_STATUS_OPTIONS,
  FOLLOWUP_TYPE_OPTIONS,
  FOLLOWUP_STATUS_COLORS,
} from '../../utils/constants';
import { message } from '../../utils/message';
import type { Followup, FollowupListQuery } from '../../types/followup';

const formFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人', type: 'elder-picker', required: true, labelField: 'elder_name' },
  { name: 'plan_type', label: '随访方式', type: 'select', required: true, options: FOLLOWUP_TYPE_OPTIONS },
  { name: 'planned_at', label: '计划时间', type: 'date', required: true },
  {
    name: 'assigned_to',
    label: '负责人',
    type: 'doctor-picker',
    required: true,
    labelField: 'assigned_to_name',
  },
  { name: 'alert_id', label: '关联预警ID', type: 'number' },
  { name: 'notes', label: '备注', type: 'textarea' },
];

const FollowupPlanPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'plan' | 'record'>('plan');
  const [formVisible, setFormVisible] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [recordFollowupId, setRecordFollowupId] = useState<number | null>(null);
  const [recordResult, setRecordResult] = useState('');
  const [recordNextAction, setRecordNextAction] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai' | 'manual'>('all');

  // Records tab state
  const [recordsData, setRecordsData] = useState<Followup[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsPagination, setRecordsPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchRecords = useCallback(async (page = 1, pageSize = 20) => {
    setRecordsLoading(true);
    try {
      const res = await getFollowups({
        page,
        page_size: pageSize,
        status: 'completed',
      });
      setRecordsData(res.data.items);
      setRecordsPagination({ current: res.data.page, pageSize: res.data.page_size, total: res.data.total });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'record') {
      fetchRecords();
    }
  }, [activeTab, fetchRecords]);

  const recordsColumns: AppTableColumn<Followup>[] = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    {
      title: '随访方式',
      dataIndex: 'plan_type',
      width: 100,
      render: (value) => formatPlanType(value as string | null | undefined),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: unknown) => {
        const followupStatus = String(status ?? '');
        return (
          <Chip
            outlined
            style={{
              color: FOLLOWUP_STATUS_COLORS[followupStatus] || 'var(--smc-text)',
              borderColor: FOLLOWUP_STATUS_COLORS[followupStatus] || 'var(--smc-divider)',
            }}
          >
            {formatFollowupStatus(followupStatus)}
          </Chip>
        );
      },
    },
    {
      title: '计划时间',
      dataIndex: 'planned_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    { title: '负责人', dataIndex: 'assigned_to_name', width: 100 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
  ];

  const fetchFn = useCallback(
    (params: FollowupListQuery & { page: number; page_size: number }) => getFollowups(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Followup, FollowupListQuery>(fetchFn);

  const filteredData = useMemo(() => {
    if (sourceFilter === 'all') {
      return data;
    }
    return data.filter((item) => {
      const isAi = item.plan_type === 'ai_suggested' || item.alert_source === 'ml';
      return sourceFilter === 'ai' ? isAi : !isAi;
    });
  }, [data, sourceFilter]);

  const handleEdit = (record: Followup) => {
    setEditingFollowup(record);
    setFormVisible(true);
  };

  const handleCreate = () => {
    setEditingFollowup(null);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: '删除随访计划',
      content: '确定删除该随访计划？',
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;

    try {
      await deleteFollowup(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleStatusUpdate = async (id: number, status: Followup['status']) => {
    const ok = await confirm({
      title: '更新随访状态',
      content: `确认将该随访标记为${formatFollowupStatus(status)}？`,
      intent: 'info',
    });
    if (!ok) return;

    try {
      await updateFollowupStatus(id, { status });
      message.success('状态更新成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleAddRecord = (followupId: number) => {
    setRecordFollowupId(followupId);
    setRecordResult('');
    setRecordNextAction('');
    setRecordModalVisible(true);
  };

  const handleRecordSubmit = async () => {
    if (!recordResult.trim()) {
      message.warning('请输入随访结果');
      return;
    }

    try {
      if (recordFollowupId) {
        await addFollowupRecord(recordFollowupId, {
          actual_time: new Date().toISOString(),
          result: recordResult,
          next_action: recordNextAction,
          status: 'completed',
        });
        message.success('记录添加成功');
        setRecordModalVisible(false);
        setRecordFollowupId(null);
        setRecordResult('');
        setRecordNextAction('');
        refresh();
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '记录失败');
    }
  };

  const columns: AppTableColumn<Followup>[] = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    {
      title: '随访方式',
      dataIndex: 'plan_type',
      width: 110,
      render: (value) => formatPlanType(value as string | null | undefined),
    },
    {
      title: 'AI 推荐',
      key: 'ai_source',
      width: 100,
      render: (_, record) => {
        const isAi = record.plan_type === 'ai_suggested' || record.alert_source === 'ml';
        if (!isAi) {
          return null;
        }
        return (
          <Chip tone="info" outlined icon={<Sparkles size={12} />}>
            AI
          </Chip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: unknown) => {
        const followupStatus = String(status ?? '');
        return (
          <Chip
            outlined
            style={{
              color: FOLLOWUP_STATUS_COLORS[followupStatus] || 'var(--smc-text)',
              borderColor: FOLLOWUP_STATUS_COLORS[followupStatus] || 'var(--smc-divider)',
            }}
          >
            {formatFollowupStatus(followupStatus)}
          </Chip>
        );
      },
    },
    {
      title: '计划时间',
      dataIndex: 'planned_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    { title: '负责人', dataIndex: 'assigned_to_name', width: 100 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PermissionGuard permission="followup:update">
            <Button
              size="sm"
              variant="text"
              startIcon={<Pencil size={14} />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {record.status === 'todo' && (
              <Button
                size="sm"
                variant="text"
                startIcon={<Play size={14} />}
                onClick={() => handleStatusUpdate(record.id, 'in_progress')}
              >
                开始
              </Button>
            )}
            {record.status === 'in_progress' && (
              <Button
                size="sm"
                variant="text"
                startIcon={<FilePlus size={14} />}
                onClick={() => handleAddRecord(record.id)}
              >
                记录结果
              </Button>
            )}
          </PermissionGuard>
          <PermissionGuard permission="followup:update">
            <Button
              size="sm"
              variant="text"
              danger
              startIcon={<Trash2 size={14} />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          </PermissionGuard>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'plan' | 'record')}
          items={[
            { key: 'plan', label: '随访计划' },
            { key: 'record', label: '随访记录' },
          ]}
        />
      </div>

      {activeTab === 'plan' ? (
        <>
          <AppTable<Followup>
            columns={columns}
            dataSource={filteredData}
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            onSearch={handleSearch}
            searchPlaceholder="搜索随访计划"
            toolbar={
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ minWidth: 120 }}>
                  <Select
                    label="状态"
                    value={query.status || ''}
                    onChange={(v) =>
                      setQuery((prev) => ({ ...prev, status: v ? String(v) : undefined }))
                    }
                    options={[{ label: '全部', value: '' }, ...FOLLOWUP_STATUS_OPTIONS]}
                  />
                </div>
                <div style={{ minWidth: 120 }}>
                  <Select
                    label="随访方式"
                    value={query.plan_type || ''}
                    onChange={(v) =>
                      setQuery((prev) => ({ ...prev, plan_type: v ? String(v) : undefined }))
                    }
                    options={[{ label: '全部', value: '' }, ...FOLLOWUP_TYPE_OPTIONS]}
                  />
                </div>
                <div style={{ minWidth: 120 }}>
                  <Select
                    label="来源"
                    value={sourceFilter}
                    onChange={(v) => setSourceFilter(String(v) as 'all' | 'ai' | 'manual')}
                    options={[
                      { label: '全部', value: 'all' },
                      { label: 'AI 推荐', value: 'ai' },
                      { label: '人工', value: 'manual' },
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
                <PermissionGuard permission="followup:create">
                  <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
                    新建随访计划
                  </Button>
                </PermissionGuard>
              </div>
            }
          />

          <AppForm
            title={editingFollowup ? '编辑随访计划' : '新建随访计划'}
            visible={formVisible}
            fields={formFields}
            initialValues={editingFollowup || undefined}
            onSubmit={async (values) => {
              if (editingFollowup) {
                await updateFollowup(editingFollowup.id, values as Parameters<typeof updateFollowup>[1]);
              } else {
                await createFollowup(values as Parameters<typeof createFollowup>[0]);
              }
              message.success(editingFollowup ? '更新成功' : '创建成功');
              setFormVisible(false);
              refresh();
            }}
            onCancel={() => setFormVisible(false)}
          />

          <Modal
            open={recordModalVisible}
            onClose={() => {
              setRecordModalVisible(false);
              setRecordFollowupId(null);
            }}
            title="记录随访结果"
            width={520}
            footer={
              <>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setRecordModalVisible(false);
                    setRecordFollowupId(null);
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleRecordSubmit}>保存</Button>
              </>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Textarea
                label="随访结果"
                required
                value={recordResult}
                onChange={(event) => setRecordResult(event.target.value)}
                rows={4}
              />
              <Textarea
                label="后续行动"
                value={recordNextAction}
                onChange={(event) => setRecordNextAction(event.target.value)}
                rows={3}
              />
            </div>
          </Modal>
        </>
      ) : (
        <AppTable<Followup>
          columns={recordsColumns}
          dataSource={recordsData}
          loading={recordsLoading}
          pagination={recordsPagination}
          onChange={(pag) => fetchRecords(pag.current, pag.pageSize)}
          emptyText="暂无随访记录"
        />
      )}
    </div>
  );
};

export default FollowupPlanPage;
