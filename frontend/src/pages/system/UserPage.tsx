import React, { useCallback, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Chip, confirm } from '../../components/ui';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import AppForm, { type FormFieldConfig } from '../../components/AppForm';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users';
import { formatDateTime } from '../../utils/formatter';
import type { User } from '../../types/user';
import type { PaginationParams } from '../../types/common';
import { message } from '../../utils/message';
import { RefPageHead, RefGrid, RefStat } from '../../components/ref';

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

const UserPage: React.FC = () => {
  const [formVisible, setFormVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchFn = useCallback(
    (params: PaginationParams & { page: number; page_size: number }) => getUsers(params),
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
    const ok = await confirm({
      title: '删除用户',
      content: '确定删除该用户？',
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;

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
      title: '角色',
      dataIndex: 'roles',
      width: 150,
      render: (value) => {
        const roles = value as User['roles'] | undefined;
        return roles?.length ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {roles.map((role) => (
              <Chip key={role.id} tone="primary" outlined>
                {role.display_name}
              </Chip>
            ))}
          </div>
        ) : (
          '-'
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value) => {
        const status = String(value);
        return (
          <Chip tone={status === 'active' ? 'success' : 'error'} outlined>
            {status === 'active' ? '正常' : '禁用'}
          </Chip>
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
        <div style={{ display: 'flex', gap: 4 }}>
          <PermissionGuard permission="user:manage">
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

  const active = data.filter((u) => u.status === 'active').length;
  const disabled = data.filter((u) => u.status === 'disabled').length;

  return (
    <>
      <RefPageHead
        title="用户管理"
        subtitle={`共 ${pagination.total ?? data.length} 位用户 · 正常 ${active} · 禁用 ${disabled}`}
        actions={
          <PermissionGuard permission="user:manage">
            <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
              新增用户
            </Button>
          </PermissionGuard>
        }
      />

      <RefGrid cols={3} style={{ marginBottom: 16 }}>
        <RefStat
          label="用户总数"
          value={pagination.total ?? data.length}
          sub="平台注册账户"
          tone="info"
        />
        <RefStat
          label="正常"
          value={active}
          sub="可正常登录"
          tone="ok"
          valueColor="var(--smc-success)"
        />
        <RefStat
          label="已禁用"
          value={disabled}
          sub="暂不可登录"
          tone="risk"
          valueColor="var(--smc-error)"
        />
      </RefGrid>

      <AppTable<User>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索用户名/姓名"
        toolbar={
          <PermissionGuard permission="user:manage">
            <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
              新增用户
            </Button>
          </PermissionGuard>
        }
      />

      <AppForm
        title={editingUser ? '编辑用户' : '新增用户'}
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
              await createUser(values as Parameters<typeof createUser>[0]);
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

export default UserPage;
