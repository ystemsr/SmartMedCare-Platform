import React, { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import {
  Button,
  Chip,
  IconButton,
  Tooltip,
  confirm,
} from '../../components/ui';
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

  const handleDelete = async (record: User) => {
    const ok = await confirm({
      title: '确认删除',
      content: `确定要删除医生「${record.real_name || record.username}」吗？此操作不可撤销。`,
      intent: 'danger',
      okText: '删除',
    });
    if (!ok) return;
    try {
      await deleteUser(record.id);
      message.success('删除成功');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
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
            tone={status === 'active' ? 'success' : 'error'}
            icon={
              status === 'active' ? (
                <CheckCircle2 size={12} />
              ) : (
                <Ban size={12} />
              )
            }
          >
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <PermissionGuard permission="user:manage">
            <Tooltip title="编辑">
              <IconButton size="sm" onClick={() => handleEdit(record)}>
                <Pencil size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip title="删除">
              <IconButton size="sm" onClick={() => handleDelete(record)}>
                <Trash2 size={14} color="var(--smc-error)" />
              </IconButton>
            </Tooltip>
          </PermissionGuard>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700 }}>医生管理</h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--smc-text-2)' }}>
          管理平台中的医生账号，包括创建、编辑、停用等操作
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          marginBottom: 24,
        }}
      >
        <StatCard
          title="医生总数"
          value={stats.total}
          suffix="人"
          icon={<Users size={20} />}
          color="#1677ff"
          loading={loading}
        />
        <StatCard
          title="正常状态"
          value={stats.active}
          suffix="人"
          icon={<CheckCircle2 size={20} />}
          color="#52c41a"
          loading={loading}
        />
        <StatCard
          title="已禁用"
          value={stats.disabled}
          suffix="人"
          icon={<Ban size={20} />}
          color="#ff4d4f"
          loading={loading}
        />
      </div>

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
            <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
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
          } catch (err) {
            message.error(err instanceof Error ? err.message : '操作失败');
          } finally {
            setSubmitLoading(false);
          }
        }}
        onCancel={() => setFormVisible(false)}
      />
    </div>
  );
};

export default DoctorPage;
