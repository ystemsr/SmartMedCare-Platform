import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getFollowups } from '../../api/followups';
import { formatDateTime, formatFollowupStatus, formatPlanType } from '../../utils/formatter';
import { FOLLOWUP_STATUS_COLORS } from '../../utils/constants';
import type { Followup } from '../../types/followup';

const FollowupRecordPage: React.FC = () => {
  const [data, setData] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchData = async (page = 1, pageSize = 20) => {
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns: ColumnsType<Followup> = [
    { title: '老人ID', dataIndex: 'elder_id', width: 80 },
    { title: '老人姓名', dataIndex: 'elder_name', width: 100 },
    {
      title: '随访方式',
      dataIndex: 'plan_type',
      width: 100,
      render: formatPlanType,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={FOLLOWUP_STATUS_COLORS[status]}>{formatFollowupStatus(status)}</Tag>
      ),
    },
    { title: '计划时间', dataIndex: 'planned_at', render: formatDateTime, width: 170 },
    { title: '负责人', dataIndex: 'assigned_to_name', width: 100 },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', render: formatDateTime, width: 170 },
  ];

  return (
    <Card title="随访记录">
      <Table<Followup>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={(pag) => fetchData(pag.current, pag.pageSize)}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};

export default FollowupRecordPage;
