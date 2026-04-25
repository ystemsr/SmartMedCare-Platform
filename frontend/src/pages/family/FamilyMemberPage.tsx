import React, { useCallback } from 'react';
import { Chip } from '../../components/ui';
import AppTable, { type AppTableColumn } from '../../components/AppTable';
import { useTable } from '../../hooks/useTable';
import { getFamilyMembers } from '../../api/family';
import { formatDateTime } from '../../utils/formatter';
import type { FamilyMemberAdmin } from '../../types/family';
import type { PaginationParams } from '../../types/common';
import { RefPageHead, RefGrid, RefStat } from '../../components/ref';

const FamilyMemberPage: React.FC = () => {
  const fetchFn = useCallback(
    (params: PaginationParams & { page: number; page_size: number }) => getFamilyMembers(params),
    [],
  );

  const { data, loading, pagination, handleTableChange, handleSearch } =
    useTable<FamilyMemberAdmin, PaginationParams>(fetchFn);

  const columns: AppTableColumn<FamilyMemberAdmin>[] = [
    { title: '用户名', dataIndex: 'username', width: 130 },
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '手机号', dataIndex: 'phone', width: 130 },
    { title: '关联老人', dataIndex: 'elder_name', width: 120 },
    {
      title: '关系',
      dataIndex: 'relationship',
      width: 100,
      render: (value) => {
        const relationship = String(value ?? '');
        return <Chip outlined>{relationship || '-'}</Chip>;
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
  ];

  const linkedCount = data.filter((d) => d.elder_name).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <RefPageHead
        title="家属管理"
        subtitle={`共 ${pagination.total ?? data.length} 位家属 · 已关联老人 ${linkedCount} 位`}
      />
      <RefGrid cols={3}>
        <RefStat
          label="家属总数"
          value={pagination.total ?? data.length}
          sub="平台全体家属"
          tone="info"
        />
        <RefStat
          label="已关联老人"
          value={linkedCount}
          sub="已完成身份绑定"
          tone="ok"
          valueColor="var(--smc-success)"
        />
        <RefStat
          label="待关联"
          value={(pagination.total ?? data.length) - linkedCount}
          sub="当前页统计"
          tone="warn"
        />
      </RefGrid>
      <AppTable<FamilyMemberAdmin>
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onSearch={handleSearch}
        searchPlaceholder="搜索用户名/姓名/手机号"
      />
    </div>
  );
};

export default FamilyMemberPage;
