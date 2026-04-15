import React, { useState, useCallback } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
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
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
  { name: 'assessment_type', label: '评估类型', type: 'select', options: ASSESSMENT_TYPE_OPTIONS },
  { name: 'score', label: '评估分数', type: 'number', required: true },
  { name: 'risk_level', label: '风险等级', type: 'select', required: true, options: RISK_LEVEL_OPTIONS },
  { name: 'summary', label: '评估摘要', type: 'textarea', required: true },
];

const AssessmentPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Assessment | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [generateElderId, setGenerateElderId] = useState('');
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
    if (!window.confirm('确定删除该评估记录？')) {
      return;
    }

    try {
      await deleteAssessment(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleGenerate = async () => {
    const elderId = Number(generateElderId);
    if (!Number.isFinite(elderId) || elderId <= 0) {
      message.warning('请输入有效的老人ID');
      return;
    }

    try {
      setGenerateLoading(true);
      await generateAssessment({
        elder_id: elderId,
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
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
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
    { title: '评估摘要', dataIndex: 'summary', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', render: formatDateTime, width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <PermissionGuard permission="assessment:create">
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button
              size="small"
              color="inherit"
              startIcon={<DeleteRoundedIcon />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          </PermissionGuard>
        </Stack>
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
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap">
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
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>评估类型</InputLabel>
              <Select
                label="评估类型"
                value={query.assessment_type || ''}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, assessment_type: event.target.value || undefined }))
                }
              >
                <MenuItem value="">全部</MenuItem>
                {ASSESSMENT_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
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
            <PermissionGuard permission="assessment:create">
              <Button
                variant="outlined"
                startIcon={<BoltRoundedIcon />}
                onClick={() => setGenerateModalVisible(true)}
              >
                自动生成评估
              </Button>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreate}>
                新建评估
              </Button>
            </PermissionGuard>
          </Stack>
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

      <Dialog
        open={generateModalVisible}
        onClose={() => {
          setGenerateModalVisible(false);
          setGenerateElderId('');
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>自动生成评估</DialogTitle>
        <DialogContent>
          <TextField
            label="老人ID"
            value={generateElderId}
            onChange={(event) => setGenerateElderId(event.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            placeholder="请输入老人ID"
          />
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              setGenerateModalVisible(false);
              setGenerateElderId('');
            }}
          >
            取消
          </Button>
          <Button variant="contained" onClick={handleGenerate} disabled={generateLoading}>
            {generateLoading ? '生成中...' : '确定'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AssessmentPage;
