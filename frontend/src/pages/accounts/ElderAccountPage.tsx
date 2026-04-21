import React, { useCallback, useState } from 'react';
import { RefreshCw, Power } from 'lucide-react';
import { Button, Chip, confirm } from '../../components/ui';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PermissionGuard from '../../components/PermissionGuard';
import CredentialsModal from '../../components/CredentialsModal';
import { useTable } from '../../hooks/useTable';
import { getElders, resetElderPassword, updateElderAccountStatus } from '../../api/elders';
import { formatGender } from '../../utils/formatter';
import type { Elder, ElderListQuery } from '../../types/elder';
import { message } from '../../utils/message';

interface CredentialsState {
  title: string;
  description?: string;
  username?: string;
  password: string;
}

const ElderAccountPage: React.FC = () => {
  const [credentials, setCredentials] = useState<CredentialsState | null>(null);

  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch } =
    useTable<Elder, ElderListQuery>(fetchFn);

  const handleResetPassword = async (elder: Elder) => {
    const ok = await confirm({
      title: '重置密码',
      content: `确定为 ${elder.name} 重置登录密码？`,
      intent: 'warning',
    });
    if (!ok) return;

    try {
      const res = await resetElderPassword(elder.id);
      setCredentials({
        title: '密码已重置',
        description: `已为 ${elder.name} 生成新密码，请交付给本人。`,
        password: res.data.new_password,
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleToggleStatus = async (elderId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const ok = await confirm({
      title: newStatus === 'active' ? '启用账户' : '禁用账户',
      content: `确定${newStatus === 'active' ? '启用' : '禁用'}该账户？`,
      intent: newStatus === 'active' ? 'info' : 'warning',
    });
    if (!ok) return;

    try {
      await updateElderAccountStatus(elderId, newStatus);
      message.success(newStatus === 'active' ? '已启用' : '已禁用');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const columns: AppTableColumn<Elder>[] = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 80,
      render: (value) => formatGender(value as string | null | undefined),
    },
    { title: '联系电话', dataIndex: 'phone', width: 130 },
    { title: '身份证号', dataIndex: 'id_card', width: 180 },
    {
      title: '账户状态',
      dataIndex: 'account_status',
      width: 100,
      render: (value) => {
        const status = String(value);
        return (
          <Chip tone={status === 'active' ? 'success' : 'error'} outlined>
            {status === 'active' ? '正常' : '已禁用'}
          </Chip>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <PermissionGuard permission="elder:update">
            <Button
              size="sm"
              variant="text"
              startIcon={<RefreshCw size={14} />}
              onClick={() => handleResetPassword(record)}
            >
              重置密码
            </Button>
            <Button
              size="sm"
              variant="text"
              danger={record.account_status === 'active'}
              startIcon={<Power size={14} />}
              onClick={() => handleToggleStatus(record.id, record.account_status)}
            >
              {record.account_status === 'active' ? '禁用' : '启用'}
            </Button>
          </PermissionGuard>
        </div>
      ),
    },
  ];

  return (
    <>
      <AppTable<Elder>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索姓名/手机号/身份证"
      />
      <CredentialsModal
        open={credentials !== null}
        onClose={() => setCredentials(null)}
        title={credentials?.title ?? ''}
        description={credentials?.description}
        username={credentials?.username}
        password={credentials?.password ?? ''}
      />
    </>
  );
};

export default ElderAccountPage;
