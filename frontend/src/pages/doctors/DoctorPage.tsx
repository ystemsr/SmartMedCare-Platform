import React, { useCallback, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Stethoscope,
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
import { RefPageHead, RefStat, RefGrid } from '../../components/ref';
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
  { name: 'password', label: '密码', type: 'password', required: true, placeholder: '至少 6 位' },
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

  const handleToggleStatus = async (record: User) => {
    const nextStatus = record.status === 'active' ? 'disabled' : 'active';
    const actionText = nextStatus === 'disabled' ? '停用' : '启用';
    const ok = await confirm({
      title: `确认${actionText}`,
      content: `确定要${actionText}医生「${record.real_name || record.username}」吗？`,
      intent: nextStatus === 'disabled' ? 'warning' : 'info',
      okText: actionText,
    });
    if (!ok) return;
    try {
      await updateUser(record.id, { status: nextStatus });
      message.success(`${actionText}成功`);
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : `${actionText}失败`);
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
              status === 'active' ? <CheckCircle2 size={12} /> : <Ban size={12} />
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
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        const isActive = record.status === 'active';
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <PermissionGuard permission="user:manage">
              <Tooltip title="编辑">
                <IconButton size="sm" onClick={() => handleEdit(record)}>
                  <Pencil size={14} />
                </IconButton>
              </Tooltip>
              <Tooltip title={isActive ? '停用' : '启用'}>
                <IconButton size="sm" onClick={() => handleToggleStatus(record)}>
                  {isActive ? (
                    <Ban size={14} color="var(--smc-warning)" />
                  ) : (
                    <CheckCircle2 size={14} color="var(--smc-success)" />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title="删除">
                <IconButton size="sm" onClick={() => handleDelete(record)}>
                  <Trash2 size={14} color="var(--smc-error)" />
                </IconButton>
              </Tooltip>
            </PermissionGuard>
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <RefPageHead
        title="医生管理"
        subtitle={`共 ${stats.total} 位医生 · 在岗 ${stats.active} · 停用 ${stats.disabled}`}
        actions={
          <PermissionGuard permission="user:manage">
            <Button startIcon={<Plus size={14} />} onClick={handleCreate}>
              新增医生
            </Button>
          </PermissionGuard>
        }
      />

      <RefGrid cols={3}>
        <RefStat
          label="医生总数"
          value={stats.total}
          sub="平台全体医生"
          icon={<Stethoscope size={16} />}
          tone="info"
        />
        <RefStat
          label="正常状态"
          value={stats.active}
          sub="可接收随访与预警"
          icon={<CheckCircle2 size={16} />}
          tone="ok"
          valueColor="var(--smc-success)"
        />
        <RefStat
          label="已禁用"
          value={stats.disabled}
          sub="暂不可登录"
          icon={<Ban size={16} />}
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
        searchPlaceholder="搜索用户名 / 姓名 / 手机号"
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
