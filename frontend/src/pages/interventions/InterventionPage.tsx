import React, { useState, useCallback } from 'react';
import { Plus, Pencil, Play, CheckCircle2, Square, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  Modal,
  Select,
  Textarea,
  confirm,
} from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
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
  { name: 'followup_id', label: '关联随访ID', type: 'number' },
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
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    { title: '干预类型', dataIndex: 'type', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: unknown) => {
        const interventionStatus = String(status ?? '');
        return (
          <Chip
            outlined
            style={{
              color: INTERVENTION_STATUS_COLORS[interventionStatus] || 'var(--smc-text)',
              borderColor:
                INTERVENTION_STATUS_COLORS[interventionStatus] || 'var(--smc-divider)',
            }}
          >
            {formatInterventionStatus(interventionStatus)}
          </Chip>
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
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PermissionGuard permission="intervention:create">
            <Button
              size="sm"
              variant="text"
              startIcon={<Pencil size={14} />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {record.status === 'planned' && (
              <Button
                size="sm"
                variant="text"
                startIcon={<Play size={14} />}
                onClick={() => openStatusModal(record.id, 'ongoing')}
              >
                开始执行
              </Button>
            )}
            {record.status === 'ongoing' && (
              <Button
                size="sm"
                variant="text"
                startIcon={<CheckCircle2 size={14} />}
                onClick={() => openStatusModal(record.id, 'completed')}
              >
                完成
              </Button>
            )}
            {(record.status === 'planned' || record.status === 'ongoing') && (
              <Button
                size="sm"
                variant="text"
                startIcon={<Square size={14} />}
                onClick={() => openStatusModal(record.id, 'stopped')}
              >
                停止
              </Button>
            )}
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
    <>
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
