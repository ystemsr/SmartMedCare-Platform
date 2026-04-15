import React, { useCallback } from 'react';
import { Button, Tag, Space, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import AppTable from '../../components/AppTable';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import { getElders, resetElderPassword, updateElderAccountStatus } from '../../api/elders';
import { formatGender } from '../../utils/formatter';
import type { Elder, ElderListQuery } from '../../types/elder';

const ElderAccountPage: React.FC = () => {
  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch } =
    useTable<Elder, ElderListQuery>(fetchFn);

  const handleResetPassword = async (elderId: number) => {
    try {
      await resetElderPassword(elderId);
      message.success('密码重置成功');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleToggleStatus = async (elderId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    try {
      await updateElderAccountStatus(elderId, newStatus);
      message.success(newStatus === 'active' ? '已启用' : '已禁用');
      refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const columns: ColumnsType<Elder> = [
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '性别', dataIndex: 'gender', width: 80, render: formatGender },
    { title: '联系电话', dataIndex: 'phone', width: 130 },
    { title: '身份证号', dataIndex: 'id_card', width: 180 },
    {
      title: '账户状态',
      dataIndex: 'account_status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '正常' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <PermissionGuard permission="elder:update">
            <Popconfirm
              title="确定重置密码？"
              onConfirm={() => handleResetPassword(record.id)}
            >
              <Button type="link" size="small">重置密码</Button>
            </Popconfirm>
            <Popconfirm
              title={`确定${record.account_status === 'active' ? '禁用' : '启用'}该账户？`}
              onConfirm={() => handleToggleStatus(record.id, record.account_status)}
            >
              <Button
                type="link"
                size="small"
                danger={record.account_status === 'active'}
              >
                {record.account_status === 'active' ? '禁用' : '启用'}
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <AppTable<Elder>
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
      onChange={handleTableChange}
      onSearch={handleSearch}
      searchPlaceholder="搜索姓名/手机号/身份证"
    />
  );
};

export default ElderAccountPage;
