/** Gender options */
export const GENDER_OPTIONS = [
  { label: '男', value: 'male' },
  { label: '女', value: 'female' },
  { label: '未知', value: 'unknown' },
];

/** Risk level options */
export const RISK_LEVEL_OPTIONS = [
  { label: '低风险', value: 'low' },
  { label: '中风险', value: 'medium' },
  { label: '高风险', value: 'high' },
  { label: '极高风险', value: 'critical' },
];

/** Alert status options */
export const ALERT_STATUS_OPTIONS = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已解决', value: 'resolved' },
  { label: '已忽略', value: 'ignored' },
];

/** Follow-up status options */
export const FOLLOWUP_STATUS_OPTIONS = [
  { label: '待执行', value: 'todo' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
  { label: '已逾期', value: 'overdue' },
  { label: '已取消', value: 'cancelled' },
];

/** Intervention status options */
export const INTERVENTION_STATUS_OPTIONS = [
  { label: '已计划', value: 'planned' },
  { label: '进行中', value: 'ongoing' },
  { label: '已完成', value: 'completed' },
  { label: '已停止', value: 'stopped' },
];

/** Follow-up plan type options */
export const FOLLOWUP_TYPE_OPTIONS = [
  { label: '电话随访', value: 'phone' },
  { label: '上门随访', value: 'home_visit' },
  { label: '视频随访', value: 'video' },
];

/** Account status options */
export const ACCOUNT_STATUS_OPTIONS = [
  { label: '正常', value: 'active' },
  { label: '已禁用', value: 'disabled' },
];

/** Risk level color mapping */
export const RISK_LEVEL_COLORS: Record<string, string> = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#ff4d4f',
  critical: '#cf1322',
};

/** Alert status color mapping */
export const ALERT_STATUS_COLORS: Record<string, string> = {
  pending: '#faad14',
  processing: '#1677ff',
  resolved: '#52c41a',
  ignored: '#8c8c8c',
};

/** Follow-up status color mapping */
export const FOLLOWUP_STATUS_COLORS: Record<string, string> = {
  todo: '#faad14',
  in_progress: '#1677ff',
  completed: '#52c41a',
  overdue: '#ff4d4f',
  cancelled: '#8c8c8c',
};

/** Intervention status color mapping */
export const INTERVENTION_STATUS_COLORS: Record<string, string> = {
  planned: '#faad14',
  ongoing: '#1677ff',
  completed: '#52c41a',
  stopped: '#8c8c8c',
};
