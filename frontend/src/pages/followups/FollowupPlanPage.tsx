import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  DatePicker,
  IconButton,
  Modal,
  Select,
  Tabs,
  Textarea,
  Tooltip,
  confirm,
} from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import StatusSwitcher from '../../components/StatusSwitcher';
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
import { RefPageHead, RefStat, RefGrid } from '../../components/ref';

type FollowupStatus = Followup['status'];

const FOLLOWUP_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  FOLLOWUP_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const buildStatusOption = (value: string) => ({
  value,
  label: FOLLOWUP_STATUS_LABEL[value] || value,
  color: FOLLOWUP_STATUS_COLORS[value] || 'var(--smc-text)',
});

// 2x2 grid — laid out in natural progression order:
//   [待执行]      [进行中]
//   [已取消]      [已完成]
const FOLLOWUP_STATUS_GRID: [
  [ReturnType<typeof buildStatusOption>, ReturnType<typeof buildStatusOption>],
  [ReturnType<typeof buildStatusOption>, ReturnType<typeof buildStatusOption>],
] = [
  [buildStatusOption('todo'), buildStatusOption('in_progress')],
  [buildStatusOption('cancelled'), buildStatusOption('completed')],
];

// Forward-only transitions. Terminal states (completed / cancelled) cannot move.
const FOLLOWUP_ALLOWED_NEXT: Record<string, string[]> = {
  todo: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  overdue: ['in_progress', 'cancelled'],
};

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
  {
    name: 'alert_ids',
    label: '关联预警',
    type: 'alert-picker',
    dependsOn: 'elder_id',
    multi: true,
    excludeLinked: true,
    initialAlertsField: 'alerts',
    placeholder: '可选 · 从该老人未被占用的预警中选择',
  },
  { name: 'notes', label: '备注', type: 'textarea' },
];

const FollowupPlanPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<Followup | null>(null);
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [recordFollowupId, setRecordFollowupId] = useState<number | null>(null);
  const [recordResult, setRecordResult] = useState('');
  const [recordNextAction, setRecordNextAction] = useState('');

  const fetchFn = useCallback(
    (params: FollowupListQuery & { page: number; page_size: number }) => getFollowups(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Followup, FollowupListQuery>(fetchFn);

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

  const handleStatusSwitch = (record: Followup, next: FollowupStatus) => {
    // in_progress → completed must go through the result modal
    if (record.status === 'in_progress' && next === 'completed') {
      setRecordFollowupId(record.id);
      setRecordResult('');
      setRecordNextAction('');
      setRecordModalVisible(true);
      return;
    }
    handleStatusUpdate(record.id, next);
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
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: unknown, record) => {
        const followupStatus = String(status ?? '');
        const inGrid = FOLLOWUP_STATUS_GRID.flat().some(
          (o) => o.value === followupStatus,
        );
        if (!inGrid) {
          return (
            <Chip
              outlined
              style={{
                color: FOLLOWUP_STATUS_COLORS[followupStatus] || 'var(--smc-text)',
                borderColor:
                  FOLLOWUP_STATUS_COLORS[followupStatus] || 'var(--smc-divider)',
              }}
            >
              {formatFollowupStatus(followupStatus)}
            </Chip>
          );
        }
        return (
          <StatusSwitcher
            current={followupStatus}
            grid={FOLLOWUP_STATUS_GRID}
            allowedNext={FOLLOWUP_ALLOWED_NEXT[followupStatus] || []}
            onChange={(next) =>
              handleStatusSwitch(record, next as FollowupStatus)
            }
          />
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
      width: 96,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <PermissionGuard permission="followup:update">
          <div
            style={{
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Tooltip title="编辑">
              <IconButton size="sm" onClick={() => handleEdit(record)}>
                <Pencil size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="sm" onClick={() => handleDelete(record.id)}>
                <Trash2 size={14} color="var(--smc-error)" />
              </IconButton>
            </Tooltip>
          </div>
        </PermissionGuard>
      ),
    },
  ];

  const pendingCount = data.filter(
    (f) => f.status === 'todo' || f.status === 'in_progress',
  ).length;
  const completedCount = data.filter((f) => f.status === 'completed').length;
  const overdueCount = data.filter((f) => f.status === 'overdue').length;

  return (
    <div>
      <RefPageHead
        title="随访管理"
        subtitle={`共 ${pagination.total ?? data.length} 条计划 · 待执行 ${pendingCount} · 已完成 ${completedCount}`}
        actions={
          <PermissionGuard permission="followup:create">
            <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
              新建随访
            </Button>
          </PermissionGuard>
        }
      />

      <RefGrid cols={4} style={{ marginBottom: 16 }}>
        <RefStat
          label="待执行"
          value={pendingCount}
          sub="当前页统计"
          tone="warn"
          valueColor="var(--smc-warning)"
        />
        <RefStat
          label="已完成"
          value={completedCount}
          sub="计入 SLA"
          tone="ok"
          valueColor="var(--smc-success)"
        />
        <RefStat
          label="已逾期"
          value={overdueCount}
          sub="超过计划时间"
          tone="risk"
          valueColor="var(--smc-error)"
        />
        <RefStat
          label="计划总数"
          value={pagination.total ?? data.length}
          sub="本月累计"
          tone="info"
        />
      </RefGrid>

      <div style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={query.status || 'all'}
          onChange={(k) =>
            setQuery((prev) => ({
              ...prev,
              status: k === 'all' ? undefined : k,
            }))
          }
          items={[
            { key: 'all', label: '全部' },
            ...FOLLOWUP_STATUS_OPTIONS.map((o) => ({
              key: o.value,
              label: o.label,
            })),
          ]}
        />
      </div>

      <AppTable<Followup>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索随访"
        toolbar={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
                新建随访
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <AppForm
        title={editingFollowup ? '编辑随访' : '新建随访'}
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
    </div>
  );
};

export default FollowupPlanPage;
