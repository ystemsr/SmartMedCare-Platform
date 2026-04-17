import React from 'react';
import { Chip, type ChipTone } from '@/components/ui';
import type { JobStatus } from '../../types/bigdata';

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: '等待中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
};

const STATUS_TONE: Record<JobStatus, ChipTone> = {
  pending: 'default',
  running: 'info',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'warning',
};

interface JobStatusChipProps {
  status: JobStatus;
}

const JobStatusChip: React.FC<JobStatusChipProps> = ({ status }) => (
  <Chip tone={STATUS_TONE[status] || 'default'} outlined>
    {STATUS_LABEL[status] || status}
  </Chip>
);

export const JOB_TYPE_LABEL: Record<string, string> = {
  mysql_to_hdfs: 'MySQL 导入 HDFS',
  build_marts: '构建数据集市',
  batch_predict: '批量预测',
  custom_hive: '自定义 Hive',
};

export const JOB_STATUS_LABEL = STATUS_LABEL;

export default JobStatusChip;
