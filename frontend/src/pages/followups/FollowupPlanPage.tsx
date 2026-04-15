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
import NoteAddRoundedIcon from '@mui/icons-material/NoteAddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
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
  { name: 'elder_id', label: '老人ID', type: 'number', required: true },
  { name: 'plan_type', label: '随访方式', type: 'select', required: true, options: FOLLOWUP_TYPE_OPTIONS },
  { name: 'planned_at', label: '计划时间', type: 'date', required: true },
  { name: 'assigned_to', label: '负责人ID', type: 'number', required: true },
  { name: 'alert_id', label: '关联预警ID', type: 'number' },
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
    if (!window.confirm('确定删除该随访计划？')) {
      return;
    }

    try {
      await deleteFollowup(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleStatusUpdate = async (id: number, status: Followup['status']) => {
    if (!window.confirm(`确认将该随访标记为${formatFollowupStatus(status)}？`)) {
      return;
    }

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
      width: 100,
      render: formatPlanType,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: unknown) => {
        const followupStatus = String(status ?? '');
        return (
          <Chip
            size="small"
            label={formatFollowupStatus(followupStatus)}
            sx={{
              color: FOLLOWUP_STATUS_COLORS[followupStatus] || 'text.primary',
              borderColor: FOLLOWUP_STATUS_COLORS[followupStatus] || 'divider',
              bgcolor: 'transparent',
            }}
            variant="outlined"
          />
        );
      },
    },
    { title: '计划时间', dataIndex: 'planned_at', render: formatDateTime, width: 170 },
    { title: '负责人', dataIndex: 'assigned_to_name', width: 100 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, record) => (
        <Stack direction="row" spacing={0.5} flexWrap="wrap">
          <PermissionGuard permission="followup:update">
            <Button
              size="small"
              startIcon={<EditRoundedIcon />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            {record.status === 'todo' && (
              <Button
                size="small"
                color="primary"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={() => handleStatusUpdate(record.id, 'in_progress')}
              >
                开始
              </Button>
            )}
            {record.status === 'in_progress' && (
              <Button
                size="small"
                color="secondary"
                startIcon={<NoteAddRoundedIcon />}
                onClick={() => handleAddRecord(record.id)}
              >
                记录结果
              </Button>
            )}
          </PermissionGuard>
          <PermissionGuard permission="followup:update">
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
      <AppTable<Followup>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索随访计划"
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
                {FOLLOWUP_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>随访方式</InputLabel>
              <Select
                label="随访方式"
                value={query.plan_type || ''}
                onChange={(event) =>
                  setQuery((prev) => ({ ...prev, plan_type: event.target.value || undefined }))
                }
              >
                <MenuItem value="">全部</MenuItem>
                {FOLLOWUP_TYPE_OPTIONS.map((option) => (
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
            <PermissionGuard permission="followup:create">
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreate}>
                新建随访计划
              </Button>
            </PermissionGuard>
          </Stack>
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

      <Dialog
        open={recordModalVisible}
        onClose={() => {
          setRecordModalVisible(false);
          setRecordFollowupId(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>记录随访结果</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="随访结果"
              value={recordResult}
              onChange={(event) => setRecordResult(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              required
            />
            <TextField
              label="后续行动"
              value={recordNextAction}
              onChange={(event) => setRecordNextAction(event.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            color="inherit"
            onClick={() => {
              setRecordModalVisible(false);
              setRecordFollowupId(null);
            }}
          >
            取消
          </Button>
          <Button variant="contained" onClick={handleRecordSubmit}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FollowupPlanPage;
