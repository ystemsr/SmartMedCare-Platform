import dayjs from 'dayjs';

/** Format date string to YYYY-MM-DD */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD');
}

/** Format datetime string to YYYY-MM-DD HH:mm:ss */
export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
}

/** Format gender enum to Chinese label */
export function formatGender(gender: string | undefined | null): string {
  const map: Record<string, string> = {
    male: '男',
    female: '女',
    unknown: '未知',
  };
  return gender ? (map[gender] || gender) : '-';
}

/** Format risk level to Chinese label */
export function formatRiskLevel(level: string | undefined | null): string {
  const map: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '极高风险',
  };
  return level ? (map[level] || level) : '-';
}

/** Format alert status to Chinese label */
export function formatAlertStatus(status: string | undefined | null): string {
  const map: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    resolved: '已解决',
    ignored: '已忽略',
  };
  return status ? (map[status] || status) : '-';
}

/** Format follow-up status to Chinese label */
export function formatFollowupStatus(status: string | undefined | null): string {
  const map: Record<string, string> = {
    todo: '待执行',
    in_progress: '进行中',
    completed: '已完成',
    overdue: '已逾期',
    cancelled: '已取消',
  };
  return status ? (map[status] || status) : '-';
}

/** Format intervention status to Chinese label */
export function formatInterventionStatus(status: string | undefined | null): string {
  const map: Record<string, string> = {
    planned: '已计划',
    ongoing: '进行中',
    completed: '已完成',
    stopped: '已停止',
  };
  return status ? (map[status] || status) : '-';
}

/** Format follow-up plan type to Chinese label */
export function formatPlanType(type: string | undefined | null): string {
  const map: Record<string, string> = {
    phone: '电话随访',
    home_visit: '上门随访',
    video: '视频随访',
    ai_suggested: 'AI 建议随访',
  };
  return type ? (map[type] || type) : '-';
}
