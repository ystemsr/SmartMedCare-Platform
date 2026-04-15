import React, { useCallback, useState } from 'react';
import { Button, Chip, Stack } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users';
import { formatDateTime } from '../../utils/formatter';
import type { User } from '../../types/user';
import type { PaginationParams } from '../../types/common';
import { message } from '../../utils/message';

const createFields: FormFieldConfig[] = [
  { name: 'username', label: '用户名', required: true },
  { name: 'real_name', label: '姓名', required: true },
  { name: 'phone', label: '手机号', required: true },
  { name: 'email', label: '邮箱' },
  { name: 'password', label: '密码', type: 'password', required: true },
];

const editFields: FormFieldConfig[] = [
  { name: 'real_name', label: '姓名', required: true },
  { name: 'phone', label: '手机号', required: true },
  { name: 'email', label: '邮箱' },
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

  const fetchFn = useCallback(
    (params: PaginationParams & { page: number; page_size: number }) =>
      getUsers({ ...params, role: 'doctor' }),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch } =
    useTable<User, PaginationParams>(fetchFn);

  const handleCreate = () => {
    setEditingUser(null);
    setFormVisible(true);
  };

  const handleEdit = (record: User) => {
    setEditingUser(record);
    setFormVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除该医生？')) {
      return;
    }

    try {
      await deleteUser(id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: AppTableColumn<User>[] = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value) => {
        const status = String(value);
        return (
          <Chip
            size="small"
            color={status === 'active' ? 'success' : 'error'}
            variant="outlined"
            label={status === 'active' ? '正常' : '禁用'}
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
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Stack direction="row" spacing={0.5}>
          <PermissionGuard permission="user:manage">
            <Button
              size="small"
              variant="text"
              startIcon={<EditRoundedIcon fontSize="small" />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button
              size="small"
              variant="text"
              color="error"
              startIcon={<DeleteRoundedIcon fontSize="small" />}
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
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={handleCreate}>
              新增医生
            </Button>
          </PermissionGuard>
        }
      />

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
          } finally {
            setSubmitLoading(false);
          }
        }}
        onCancel={() => setFormVisible(false)}
      />
    </>
  );
};

export default DoctorPage;
