import React, { useCallback } from 'react';
import type { ColumnsType } from 'antd/es/table';
import AppTable from '../../components/AppTable';
import { useTable } from '../../hooks/useTable';
import { getFamilyMembers } from '../../api/family';
import { formatDateTime } from '../../utils/formatter';
import type { FamilyMemberAdmin } from '../../types/family';
import type { PaginationParams } from '../../types/common';

const FamilyMemberPage: React.FC = () => {
  const fetchFn = useCallback(
    (params: PaginationParams & { page: number; page_size: number }) => getFamilyMembers(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, handleSearch } =
    useTable<FamilyMemberAdmin, PaginationParams>(fetchFn);

  const columns: ColumnsType<FamilyMemberAdmin> = [
    { title: '用户名', dataIndex: 'username', width: 130 },
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '关联老人', dataIndex: 'elder_name', width: 120 },
    { title: '关系', dataIndex: 'relationship', width: 100 },
    { title: '注册时间', dataIndex: 'created_at', render: formatDateTime, width: 170 },
  ];

  return (
    <AppTable<FamilyMemberAdmin>
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
      onChange={handleTableChange}
      onSearch={handleSearch}
      searchPlaceholder="搜索用户名/姓名/手机号"
    />
  );
};

export default FamilyMemberPage;
