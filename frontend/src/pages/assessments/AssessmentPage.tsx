import React, { useState, useCallback } from 'react';
import { Plus, Zap, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  Chip,
  DatePicker,
  Modal,
  Select,
  confirm,
} from '../../components/ui';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import ElderPicker from '../../components/ElderPicker';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import {
  getAssessments,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  generateAssessment,
} from '../../api/assessments';
import { formatDateTime, formatRiskLevel } from '../../utils/formatter';
import { RISK_LEVEL_OPTIONS, RISK_LEVEL_COLORS } from '../../utils/constants';
import { message } from '../../utils/message';
import type { Assessment, AssessmentListQuery } from '../../types/assessment';

const ASSESSMENT_TYPE_OPTIONS = [
  { label: '综合评估', value: 'comprehensive' },
  { label: '血压评估', value: 'blood_pressure' },
  { label: '血糖评估', value: 'blood_glucose' },
  { label: '心理评估', value: 'mental' },
];

const formFields: FormFieldConfig[] = [
  { name: 'elder_id', label: '老人', type: 'elder-picker', required: true, labelField: 'elder_name' },
  { name: 'assessment_type', label: '评估类型', type: 'select', options: ASSESSMENT_TYPE_OPTIONS },
  { name: 'score', label: '评估分数', type: 'number', required: true },
  { name: 'risk_level', label: '风险等级', type: 'select', required: true, options: RISK_LEVEL_OPTIONS },
  { name: 'summary', label: '评估摘要', type: 'textarea', required: true },
];

const AssessmentPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Assessment | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateElderId, setGenerateElderId] = useState<number | ''>('');
  const [generateLoading, setGenerateLoading] = useState(false);

  const fetchFn = useCallback(
    (params: AssessmentListQuery & { page: number; page_size: number }) => getAssessments(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch, query, setQuery } =
    useTable<Assessment, AssessmentListQuery>(fetchFn);

  const handleCreate = () => {
    setEditingItem(null);
    setFormVisible(true);
  };

  const handleEdit = (record: Assessment) => {
    setEditingItem(record);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: '删除评估记录',
      content: '确定删除该评估记录？',
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;

    try {
      await deleteAssessment(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleGenerate = async () => {
    if (generateElderId === '' || !Number.isFinite(generateElderId) || generateElderId <= 0) {
      message.warning('请选择老人');
      return;
    }

    try {
      setGenerateLoading(true);
      await generateAssessment({
        elder_id: generateElderId,
        force_recalculate: true,
      });
      message.success('评估生成成功');
      setGenerateModalVisible(false);
      setGenerateElderId('');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生成失败');
    } finally {
      setGenerateLoading(false);
    }
  };

  const columns: AppTableColumn<Assessment>[] = [
    {
      title: '老人姓名',
      dataIndex: 'elder_name',
      width: 120,
      render: (value) => (value ? String(value) : '-'),
    },
    { title: '评估类型', dataIndex: 'assessment_type', width: 120 },
    { title: '评分', dataIndex: 'score', width: 80 },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
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
    { title: '评估摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <PermissionGuard permission="assessment:create">
            <Button
              size="sm"
              variant="text"
              startIcon={<Pencil size={14} />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
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
      <AppTable<Assessment>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索评估"
        toolbar={
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
            <div style={{ minWidth: 140 }}>
              <Select
                label="评估类型"
                value={query.assessment_type || ''}
                onChange={(v) =>
                  setQuery((prev) => ({ ...prev, assessment_type: v ? String(v) : undefined }))
                }
                options={[{ label: '全部', value: '' }, ...ASSESSMENT_TYPE_OPTIONS]}
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
            <PermissionGuard permission="assessment:create">
              <Button
                variant="outlined"
                startIcon={<Zap size={14} />}
                onClick={() => setGenerateModalVisible(true)}
              >
                自动生成评估
              </Button>
              <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
                新建评估
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <AppForm
        title={editingItem ? '编辑评估' : '新建评估'}
        visible={formVisible}
        fields={formFields}
        initialValues={editingItem || undefined}
        onSubmit={async (values) => {
          if (editingItem) {
            await updateAssessment(editingItem.id, values as Parameters<typeof updateAssessment>[1]);
          } else {
            await createAssessment(values as Parameters<typeof createAssessment>[0]);
          }
          message.success(editingItem ? '更新成功' : '创建成功');
          setFormVisible(false);
          refresh();
        }}
        onCancel={() => setFormVisible(false)}
      />

      <Modal
        open={generateModalVisible}
        onClose={() => {
          setGenerateModalVisible(false);
          setGenerateElderId('');
        }}
        title="自动生成评估"
        width={520}
        footer={
          <>
            <Button
              variant="outlined"
              onClick={() => {
                setGenerateModalVisible(false);
                setGenerateElderId('');
              }}
            >
              取消
            </Button>
            <Button onClick={handleGenerate} loading={generateLoading}>
              {generateLoading ? '生成中...' : '确定'}
            </Button>
          </>
        }
      >
        <ElderPicker
          label="老人"
          required
          value={generateElderId}
          onChange={(id) => setGenerateElderId(id)}
        />
      </Modal>
    </>
  );
};

export default AssessmentPage;
