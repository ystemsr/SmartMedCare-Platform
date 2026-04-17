import React from 'react';
import { Chip } from '@mui/material';
import type { JobStatus } from '../../types/bigdata';

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: '等待中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
};

const STATUS_COLOR: Record<JobStatus, string> = {
  pending: '#8c8c8c',
  running: '#1677ff',
  succeeded: '#52c41a',
  failed: '#ff4d4f',
  cancelled: '#faad14',
};

interface JobStatusChipProps {
  status: JobStatus;
}

const JobStatusChip: React.FC<JobStatusChipProps> = ({ status }) => {
  const color = STATUS_COLOR[status] || '#8c8c8c';
  return (
    <Chip
      size="small"
      label={STATUS_LABEL[status] || status}
      variant="outlined"
      sx={{ color, borderColor: color, bgcolor: 'transparent', fontWeight: 600 }}
    />
  );
};

export const JOB_TYPE_LABEL: Record<string, string> = {
  mysql_to_hdfs: 'MySQL 导入 HDFS',
  build_marts: '构建数据集市',
  batch_predict: '批量预测',
  custom_hive: '自定义 Hive',
};

export const JOB_STATUS_LABEL = STATUS_LABEL;

export default JobStatusChip;
