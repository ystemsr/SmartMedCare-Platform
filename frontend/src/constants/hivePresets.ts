import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  HeartPulse,
  MapPin,
  Stethoscope,
} from 'lucide-react';

export interface HivePreset {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Read-only SELECT. Must be safe for Hive's SELECT-only allow-list. */
  sql: string;
  /** Recommended row limit when running this preset. */
  defaultLimit?: number;
}

export const HIVE_PRESETS: HivePreset[] = [
  {
    id: 'risk_distribution',
    title: '老人风险等级分布',
    description: '按 AI 健康分数将老人分为高/中/低三档，统计各档人数。',
    icon: HeartPulse,
    sql: `SELECT
  risk_level,
  COUNT(*) AS elder_count
FROM smartmedcare.mart_elder_risk_summary
GROUP BY risk_level
ORDER BY CASE risk_level
  WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
END`,
    defaultLimit: 50,
  },
  {
    id: 'high_risk_top20',
    title: '高风险老人 Top 20',
    description: '按最新预测的高风险概率降序，列出最需要关注的 20 位老人。',
    icon: AlertTriangle,
    sql: `SELECT
  elder_id,
  name,
  age,
  gender,
  ROUND(hr_prob, 3) AS high_risk_prob,
  ROUND(health_score, 1) AS health_score,
  last_alert_at
FROM smartmedcare.mart_elder_risk_summary
WHERE risk_level = 'high'
ORDER BY hr_prob DESC
LIMIT 20`,
    defaultLimit: 100,
  },
  {
    id: 'alerts_last_7days',
    title: '最近 7 天告警趋势',
    description: '按天统计告警数量，并区分已处理与未处理。',
    icon: Activity,
    sql: `SELECT
  alert_date,
  SUM(alert_count) AS alert_count,
  SUM(resolved_count) AS resolved_count,
  SUM(pending_count) AS pending_count
FROM smartmedcare.mart_daily_alerts
WHERE alert_date >= DATE_SUB(CURRENT_DATE, 7)
GROUP BY alert_date
ORDER BY alert_date DESC`,
    defaultLimit: 200,
  },
  {
    id: 'followup_completion',
    title: '随访完成率',
    description: '按随访类型统计计划、完成、逾期数量与完成率。',
    icon: CalendarCheck2,
    sql: `SELECT
  plan_type,
  total_count,
  done_count,
  todo_count,
  overdue_count,
  ROUND(completion_rate * 100, 1) AS completion_rate_pct
FROM smartmedcare.mart_followup_completion
ORDER BY total_count DESC`,
    defaultLimit: 100,
  },
  {
    id: 'intervention_effectiveness',
    title: '干预措施有效性',
    description: '按干预类型统计总次数、完成率与覆盖老人数。',
    icon: Stethoscope,
    sql: `SELECT
  intervention_type,
  total_count,
  completed_count,
  ROUND(completion_rate * 100, 1) AS completion_rate_pct,
  unique_elders
FROM smartmedcare.mart_intervention_effectiveness
ORDER BY total_count DESC`,
    defaultLimit: 100,
  },
  {
    id: 'regional_top20',
    title: '各区域老人数量 Top 20',
    description: '根据地址前 6 个字符聚合，显示老人最多的 20 个区域。',
    icon: MapPin,
    sql: `SELECT
  SUBSTR(address, 1, 6) AS region,
  COUNT(*) AS elder_count
FROM smartmedcare.raw_elders
WHERE dt = (SELECT MAX(dt) FROM smartmedcare.raw_elders)
  AND deleted_at IS NULL
  AND address IS NOT NULL
  AND address <> ''
GROUP BY SUBSTR(address, 1, 6)
ORDER BY elder_count DESC
LIMIT 20`,
    defaultLimit: 50,
  },
];
