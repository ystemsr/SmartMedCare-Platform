import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import StatCard from '../../components/StatCard';
import { useTable } from '../../hooks/useTable';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users';
import { formatDateTime } from '../../utils/formatter';
import type { User } from '../../types/user';
import type { PaginationParams } from '../../types/common';
import { message } from '../../utils/message';

const createFields: FormFieldConfig[] = [
  { name: 'username', label: '用户名', required: true, placeholder: '请输入用户名' },
  { name: 'real_name', label: '姓名', required: true, placeholder: '请输入真实姓名' },
  { name: 'phone', label: '手机号', required: true, placeholder: '请输入手机号' },
  { name: 'email', label: '邮箱', placeholder: '选填，例如 name@example.com' },
  { name: 'password', label: '密码', type: 'password', required: true, placeholder: '至少6位' },
];

const editFields: FormFieldConfig[] = [
  { name: 'real_name', label: '姓名', required: true, placeholder: '请输入真实姓名' },
  { name: 'phone', label: '手机号', required: true, placeholder: '请输入手机号' },
  { name: 'email', label: '邮箱', placeholder: '选填，例如 name@example.com' },
  {
    name: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '正常', value: 'active' },
      { label: '禁用', value: 'disabled' },
    ],
  },
];

const DoctorPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const fetchFn = useCallback(
    (params: PaginationParams & { page: number; page_size: number }) =>
      getUsers({ ...params, role: 'doctor' }),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch } =
    useTable<User, PaginationParams>(fetchFn);

  const stats = useMemo(() => {
    const total = pagination ? pagination.total : data.length;
    const active = data.filter((u) => u.status === 'active').length;
    const disabled = data.filter((u) => u.status === 'disabled').length;
    return { total, active, disabled };
  }, [data, pagination]);

  const handleCreate = () => {
    setEditingUser(null);
    setFormVisible(true);
  };

  const handleEdit = (record: User) => {
    setEditingUser(record);
    setFormVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns: AppTableColumn<User>[] = [
    { title: '用户名', dataIndex: 'username', width: 130 },
    { title: '姓名', dataIndex: 'real_name', width: 110 },
    { title: '手机号', dataIndex: 'phone', width: 140 },
    { title: '邮箱', dataIndex: 'email', width: 200, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => {
        const status = String(value);
        return (
          <Chip
            size="small"
            icon={
              status === 'active' ? (
                <CheckCircleRoundedIcon fontSize="small" />
              ) : (
                <BlockRoundedIcon fontSize="small" />
              )
            }
            color={status === 'active' ? 'success' : 'error'}
            variant="filled"
            label={status === 'active' ? '正常' : '禁用'}
            sx={{
              fontWeight: 600,
              '& .MuiChip-icon': { fontSize: 16 },
            }}
          />
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Stack direction="row" spacing={0.5}>
          <PermissionGuard permission="user:manage">
            <Tooltip title="编辑" arrow>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleEdit(record)}
              >
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除" arrow>
              <IconButton
                size="small"
                color="error"
                onClick={() => setDeleteTarget(record)}
              >
                <DeleteRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </PermissionGuard>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          医生管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          管理平台中的医生账号，包括创建、编辑、停用等操作
        </Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="医生总数"
            value={stats.total}
            suffix="人"
            icon={<GroupRoundedIcon />}
            color="#1677ff"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="正常状态"
            value={stats.active}
            suffix="人"
            icon={<CheckCircleRoundedIcon />}
            color="#52c41a"
            loading={loading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="已禁用"
            value={stats.disabled}
            suffix="人"
            icon={<BlockRoundedIcon />}
            color="#ff4d4f"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* Table */}
      <AppTable<User>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索用户名/姓名/手机号"
        toolbar={
          <PermissionGuard permission="user:manage">
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={handleCreate}
              sx={{
                px: 2.5,
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: 2,
                '&:hover': { boxShadow: 4 },
              }}
            >
              新增医生
            </Button>
          </PermissionGuard>
        }
      />

      {/* Create / Edit form dialog */}
      <AppForm
        title={editingUser ? '编辑医生' : '新增医生'}
        visible={formVisible}
        fields={editingUser ? editFields : createFields}
        initialValues={editingUser || undefined}
        confirmLoading={submitLoading}
        onSubmit={async (values) => {
          setSubmitLoading(true);
          try {
            if (editingUser) {
              await updateUser(editingUser.id, values as Parameters<typeof updateUser>[1]);
            } else {
              await createUser({ ...values, role_ids: [2] } as Parameters<typeof createUser>[0]);
            }
            message.success(editingUser ? '更新成功' : '创建成功');
            setFormVisible(false);
            refresh();
          } catch (err) {
            message.error(err instanceof Error ? err.message : '操作失败');
          } finally {
            setSubmitLoading(false);
          }
        }}
        onCancel={() => setFormVisible(false)}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            确定要删除医生「{deleteTarget?.real_name || deleteTarget?.username}」吗？此操作不可撤销。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">
            取消
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorPage;
