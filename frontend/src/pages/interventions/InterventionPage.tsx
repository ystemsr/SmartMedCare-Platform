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
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
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
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
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
    if (!window.confirm('确定删除该干预记录？')) {
      return;
    }

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

    if (!window.confirm(`确认将该干预标记为${formatInterventionStatus(statusTarget.status)}？`)) {
      return;
    }

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
            size="small"
            label={formatInterventionStatus(interventionStatus)}
            sx={{
              color: INTERVENTION_STATUS_COLORS[interventionStatus] || 'text.primary',
              borderColor: INTERVENTION_STATUS_COLORS[interventionStatus] || 'divider',
              bgcolor: 'transparent',
            }}
            variant="outlined"
          />
        );
      },
    },
    { title: '干预内容', dataIndex: 'content', ellipsis: true },
    { title: '执行时间', dataIndex: 'performed_at', render: formatDateTime, width: 170 },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <PermissionGuard permission="intervention:create">
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {record.status === 'planned' && (
              <Button
                size="small"
                color="primary"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={() => openStatusModal(record.id, 'ongoing')}
              >
                开始执行
              </Button>
            )}
            {record.status === 'ongoing' && (
              <Button
                size="small"
                color="success"
                startIcon={<TaskAltRoundedIcon />}
                onClick={() => openStatusModal(record.id, 'completed')}
              >
                完成
              </Button>
            )}
            {(record.status === 'planned' || record.status === 'ongoing') && (
              <Button
                size="small"
                color="inherit"
                startIcon={<StopRoundedIcon />}
                onClick={() => openStatusModal(record.id, 'stopped')}
              >
                停止
              </Button>
            )}
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
      <AppTable<Intervention>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索干预记录"
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
                {INTERVENTION_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>干预类型</InputLabel>
              <Select
                label="干预类型"
                value={query.type || ''}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, type: event.target.value || undefined }))
                }
              >
                <MenuItem value="">全部</MenuItem>
                {INTERVENTION_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <PermissionGuard permission="intervention:create">
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreate}>
                新建干预
              </Button>
            </PermissionGuard>
          </Stack>
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

      <Dialog
        open={statusModalVisible}
        onClose={() => {
          setStatusModalVisible(false);
          setStatusTarget(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>更新干预状态</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="执行结果"
              value={statusResult}
              onChange={(event) => setStatusResult(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              setStatusModalVisible(false);
              setStatusTarget(null);
            }}
          >
            取消
          </Button>
          <Button variant="contained" onClick={handleStatusSubmit}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InterventionPage;
