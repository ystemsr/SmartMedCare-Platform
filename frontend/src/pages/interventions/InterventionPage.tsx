import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  IconButton,
  Modal,
  Select,
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
  getInterventions,
  createIntervention,
  updateIntervention,
  updateInterventionStatus,
  deleteIntervention,
} from '../../api/interventions';
import { formatDateTime, formatInterventionStatus } from '../../utils/formatter';
import { INTERVENTION_STATUS_OPTIONS, INTERVENTION_STATUS_COLORS } from '../../utils/constants';
import { message } from '../../utils/message';
import type { Intervention, InterventionListQuery } from '../../types/intervention';
import { RefPageHead, RefGrid, RefStat, RefCard } from '../../components/ref';

type InterventionStatus = Intervention['status'];

const INTERVENTION_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  INTERVENTION_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

const buildStatusOption = (value: string) => ({
  value,
  label: INTERVENTION_STATUS_LABEL[value] || value,
  color: INTERVENTION_STATUS_COLORS[value] || 'var(--smc-text)',
});

// 2x2 grid — laid out in natural progression order:
//   [已计划]   [进行中]
//   [已停止]   [已完成]
const INTERVENTION_STATUS_GRID: [
  [ReturnType<typeof buildStatusOption>, ReturnType<typeof buildStatusOption>],
  [ReturnType<typeof buildStatusOption>, ReturnType<typeof buildStatusOption>],
] = [
  [buildStatusOption('planned'), buildStatusOption('ongoing')],
  [buildStatusOption('stopped'), buildStatusOption('completed')],
];

// Forward-only transitions. Terminal states (completed / stopped) cannot move.
const INTERVENTION_ALLOWED_NEXT: Record<string, string[]> = {
  planned: ['ongoing', 'stopped'],
  ongoing: ['completed', 'stopped'],
  completed: [],
  stopped: [],
};

const INTERVENTION_TYPE_OPTIONS = [
  { label: '用药指导', value: 'medication_guidance' },
  { label: '饮食建议', value: 'diet_advice' },
  { label: '运动指导', value: 'exercise_guidance' },
  { label: '心理干预', value: 'mental_intervention' },
  { label: '其他', value: 'other' },
];

const formFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人', type: 'elder-picker', required: true, labelField: 'elder_name' },
  { name: 'type', label: '干预类型', type: 'select', required: true, options: INTERVENTION_TYPE_OPTIONS },
  { name: 'content', label: '干预内容', type: 'textarea', required: true },
  {
    name: 'followup_id',
    label: '关联随访',
    type: 'followup-picker',
    dependsOn: 'elder_id',
    placeholder: '可选 · 从该老人的随访中选择',
  },
  { name: 'planned_at', label: '计划时间', type: 'date' },
];

const InterventionPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Intervention | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ id: number; status: Intervention['status'] } | null>(null);
  const [statusResult, setStatusResult] = useState('');

  const fetchFn = useCallback(
    (params: InterventionListQuery & { page: number; page_size: number }) => getInterventions(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Intervention, InterventionListQuery>(fetchFn);

  const handleCreate = () => {
    setEditingItem(null);
    setFormVisible(true);
  };

  const handleEdit = (record: Intervention) => {
    setEditingItem(record);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: '删除干预记录',
      content: '确定删除该干预记录？',
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;

    try {
      await deleteIntervention(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const openStatusModal = (id: number, status: Intervention['status']) => {
    setStatusTarget({ id, status });
    setStatusResult('');
    setStatusModalVisible(true);
  };

  const handleDirectStatusUpdate = async (
    id: number,
    status: InterventionStatus,
  ) => {
    const ok = await confirm({
      title: '更新干预状态',
      content: `确认将该干预标记为${formatInterventionStatus(status)}？`,
      intent: 'info',
    });
    if (!ok) return;
    try {
      await updateInterventionStatus(id, { status });
      message.success('状态更新成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleStatusSwitch = (
    record: Intervention,
    next: InterventionStatus,
  ) => {
    // ongoing → completed must go through the result modal
    if (record.status === 'ongoing' && next === 'completed') {
      openStatusModal(record.id, next);
      return;
    }
    handleDirectStatusUpdate(record.id, next);
  };

  const handleStatusSubmit = async () => {
    if (!statusTarget) {
      return;
    }

    const ok = await confirm({
      title: '更新干预状态',
      content: `确认将该干预标记为${formatInterventionStatus(statusTarget.status)}？`,
      intent: 'info',
    });
    if (!ok) return;

    try {
      await updateInterventionStatus(statusTarget.id, {
        status: statusTarget.status,
        result: statusResult,
      });
      message.success('状态更新成功');
      setStatusModalVisible(false);
      setStatusTarget(null);
      setStatusResult('');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const columns: AppTableColumn<Intervention>[] = [
    {
      title: '老人姓名',
      dataIndex: 'elder_name',
      width: 120,
      render: (value) => (value ? String(value) : '-'),
    },
    { title: '干预类型', dataIndex: 'type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: unknown, record) => {
        const interventionStatus = String(status ?? '');
        const inGrid = INTERVENTION_STATUS_GRID.flat().some(
          (o) => o.value === interventionStatus,
        );
        if (!inGrid) {
          return (
            <Chip
              outlined
              style={{
                color:
                  INTERVENTION_STATUS_COLORS[interventionStatus] || 'var(--smc-text)',
                borderColor:
                  INTERVENTION_STATUS_COLORS[interventionStatus] || 'var(--smc-divider)',
              }}
            >
              {formatInterventionStatus(interventionStatus)}
            </Chip>
          );
        }
        return (
          <StatusSwitcher
            current={interventionStatus}
            grid={INTERVENTION_STATUS_GRID}
            allowedNext={INTERVENTION_ALLOWED_NEXT[interventionStatus] || []}
            onChange={(next) =>
              handleStatusSwitch(record, next as InterventionStatus)
            }
          />
        );
      },
    },
    { title: '干预内容', dataIndex: 'content', ellipsis: true },
    {
      title: '执行时间',
      dataIndex: 'performed_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    {
      title: '操作',
      key: 'actions',
      width: 96,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <PermissionGuard permission="intervention:create">
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

  const byType = INTERVENTION_TYPE_OPTIONS.map((t) => ({
    label: t.label,
    count: data.filter((d) => d.type === t.value).length,
    color:
      t.value === 'medication_guidance'
        ? 'var(--smc-primary)'
        : t.value === 'diet_advice'
          ? 'var(--smc-success)'
          : t.value === 'exercise_guidance'
            ? 'var(--smc-warning)'
            : t.value === 'mental_intervention'
              ? '#6e4fc9'
              : 'var(--smc-text-3)',
  }));
  const maxBy = Math.max(1, ...byType.map((b) => b.count));
  const pending = data.filter((d) => d.status === 'planned').length;
  const inProgress = data.filter((d) => d.status === 'ongoing').length;
  const completed = data.filter((d) => d.status === 'completed').length;

  return (
    <>
      <RefPageHead
        title="干预记录"
        subtitle={`累计 ${pagination.total ?? data.length} 条 · 待执行 ${pending} · 执行中 ${inProgress} · 已完成 ${completed}`}
        actions={
          <PermissionGuard permission="intervention:create">
            <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
              新增记录
            </Button>
          </PermissionGuard>
        }
      />

      <div
        className="ref-grid"
        style={{ gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}
      >
        <RefCard title="干预类型分布" subtitle="按类型统计数量">
          {byType.map((b, i) => (
            <div key={b.label} style={{ marginBottom: i === byType.length - 1 ? 0 : 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 5,
                }}
              >
                <span>{b.label}</span>
                <span className="ref-num" style={{ color: 'var(--smc-text-3)' }}>
                  {b.count}
                </span>
              </div>
              <div className="ref-bar-track">
                <div
                  className="ref-bar-fill"
                  style={{ width: `${(b.count / maxBy) * 100}%`, background: b.color }}
                />
              </div>
            </div>
          ))}
          {byType.every((b) => b.count === 0) && (
            <div
              style={{
                color: 'var(--smc-text-3)',
                textAlign: 'center',
                padding: 16,
                fontSize: 13,
              }}
            >
              暂无干预数据
            </div>
          )}
        </RefCard>
        <RefGrid cols={2}>
          <RefStat
            label="待执行"
            value={pending}
            sub="尚未开始"
            tone="warn"
            valueColor="var(--smc-warning)"
          />
          <RefStat
            label="执行中"
            value={inProgress}
            sub="正在跟进"
            tone="info"
          />
          <RefStat
            label="已完成"
            value={completed}
            sub="计入成效评估"
            tone="ok"
            valueColor="var(--smc-success)"
          />
          <RefStat
            label="本月累计"
            value={pagination.total ?? data.length}
            sub="含全部状态"
            tone="primary"
          />
        </RefGrid>
      </div>

      <AppTable<Intervention>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索干预记录"
        toolbar={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 120 }}>
              <Select
                label="状态"
                value={query.status || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, status: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...INTERVENTION_STATUS_OPTIONS]}
              />
            </div>
            <div style={{ minWidth: 120 }}>
              <Select
                label="干预类型"
                value={query.type || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, type: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...INTERVENTION_TYPE_OPTIONS]}
              />
            </div>
            <PermissionGuard permission="intervention:create">
              <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
                新建干预
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <AppForm
        title={editingItem ? '编辑干预记录' : '新建干预记录'}
        visible={formVisible}
        fields={formFields}
        initialValues={editingItem || undefined}
        onSubmit={async (values) => {
          if (editingItem) {
            await updateIntervention(editingItem.id, values as Parameters<typeof updateIntervention>[1]);
          } else {
            await createIntervention(values as Parameters<typeof createIntervention>[0]);
          }
          message.success(editingItem ? '更新成功' : '创建成功');
          setFormVisible(false);
          refresh();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        open={statusModalVisible}
        onClose={() => {
          setStatusModalVisible(false);
          setStatusTarget(null);
        }}
        title="更新干预状态"
        width={520}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setStatusModalVisible(false);
                setStatusTarget(null);
              }}
            >
              取消
            </Button>
            <Button onClick={handleStatusSubmit}>保存</Button>
          </>
        }
      >
        <Textarea
          label="执行结果"
          value={statusResult}
          onChange={(event) => setStatusResult(event.target.value)}
          rows={4}
        />
      </Modal>
    </>
  );
};

export default InterventionPage;
