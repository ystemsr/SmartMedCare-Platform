import React, { useCallback } from 'react';
import { Button, Chip, Stack } from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import PermissionGuard from '../../components/PermissionGuard';
import { useTable } from '../../hooks/useTable';
import { getElders, resetElderPassword, updateElderAccountStatus } from '../../api/elders';
import { formatGender } from '../../utils/formatter';
import type { Elder, ElderListQuery } from '../../types/elder';
import { message } from '../../utils/message';

const ElderAccountPage: React.FC = () => {
  const fetchFn = useCallback(
    (params: ElderListQuery & { page: number; page_size: number }) => getElders(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, refresh, handleSearch } =
    useTable<Elder, ElderListQuery>(fetchFn);

  const handleResetPassword = async (elderId: number) => {
    if (!window.confirm('确定重置密码？')) {
      return;
    }

    try {
      await resetElderPassword(elderId);
      message.success('密码重置成功');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleToggleStatus = async (elderId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    if (!window.confirm(`确定${newStatus === 'active' ? '启用' : '禁用'}该账户？`)) {
      return;
    }

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
    { title: '性别', dataIndex: 'gender', width: 80, render: formatGender },
    { title: '联系电话', dataIndex: 'phone', width: 130 },
    { title: '身份证号', dataIndex: 'id_card', width: 180 },
    {
      title: '账户状态',
      dataIndex: 'account_status',
      width: 100,
      render: (status: string) => (
        <Chip
          size="small"
          color={status === 'active' ? 'success' : 'error'}
          variant="outlined"
          label={status === 'active' ? '正常' : '已禁用'}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Stack direction="row" spacing={0.5}>
          <PermissionGuard permission="elder:update">
            <Button
              size="small"
              variant="text"
              startIcon={<RestartAltRoundedIcon fontSize="small" />}
              onClick={() => handleResetPassword(record.id)}
            >
              重置密码
            </Button>
            <Button
              size="small"
              variant="text"
              color={record.account_status === 'active' ? 'error' : 'primary'}
              startIcon={<PowerSettingsNewRoundedIcon fontSize="small" />}
              onClick={() => handleToggleStatus(record.id, record.account_status)}
            >
              {record.account_status === 'active' ? '禁用' : '启用'}
            </Button>
          </PermissionGuard>
        </Stack>
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
