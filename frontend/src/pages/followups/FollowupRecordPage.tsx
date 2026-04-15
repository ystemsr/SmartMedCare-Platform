import React, { useCallback, useEffect, useState } from 'react';
import { Chip } from '@mui/material';
import type { AppTableColumn } from '../../components/AppTable';
import AppTable from '../../components/AppTable';
import { getFollowups } from '../../api/followups';
import { formatDateTime, formatFollowupStatus, formatPlanType } from '../../utils/formatter';
import { FOLLOWUP_STATUS_COLORS } from '../../utils/constants';
import { message } from '../../utils/message';
import type { Followup } from '../../types/followup';

const FollowupRecordPage: React.FC = () => {
  const [data, setData] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await getFollowups({
        page,
        page_size: pageSize,
        status: 'completed',
      });
      setData(res.data.items);
      setPagination({ current: res.data.page, pageSize: res.data.page_size, total: res.data.total });
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: AppTableColumn<Followup>[] = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    {
      title: '随访方式',
      dataIndex: 'plan_type',
      width: 100,
      render: (value) => formatPlanType(value as string | null | undefined),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: unknown) => {
        const followupStatus = String(status ?? '');
        return (
          <Chip
            size="small"
            label={formatFollowupStatus(followupStatus)}
            sx={{
              color: FOLLOWUP_STATUS_COLORS[followupStatus] || 'text.primary',
              borderColor: FOLLOWUP_STATUS_COLORS[followupStatus] || 'divider',
              bgcolor: 'transparent',
            }}
            variant="outlined"
          />
        );
      },
    },
    {
      title: '计划时间',
      dataIndex: 'planned_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
    { title: '负责人', dataIndex: 'assigned_to_name', width: 100 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (value) => formatDateTime(value as string | null | undefined),
      width: 170,
    },
  ];

  return (
    <AppTable<Followup>
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
      onChange={(pag) => fetchData(pag.current, pag.pageSize)}
      emptyText="暂无随访记录"
    />
  );
};

export default FollowupRecordPage;
