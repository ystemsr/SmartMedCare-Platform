import http from './http';
import type { ApiResponse } from '../types/common';

export interface DashboardOverview {
  elder_total: number;
  high_risk_total: number;
  pending_alert_total: number;
  todo_followup_total: number;
  completed_followup_today: number;
  assessment_total_today: number;
}

export interface TodoItem {
  id: number;
  type: string;
  title: string;
  description: string;
  priority: string;
  due_at?: string;
  related_id?: number;
}

export interface TrendPoint {
  date: string;
  alerts: number;
  followups: number;
  assessments: number;
}

/**
 * UI-friendly shape. The backend returns a list of daily TrendPoint
 * records; getTrends() pivots them into parallel arrays so chart
 * libraries can consume them directly.
 */
export interface TrendData {
  dates: string[];
  alerts: number[];
  followups: number[];
  assessments: number[];
}

export function getOverview(): Promise<ApiResponse<DashboardOverview>> {
  return http.get('/dashboard/overview');
}

export function getTodos(limit?: number): Promise<ApiResponse<TodoItem[]>> {
  return http.get('/dashboard/todos', { params: { limit } });
}

export async function getTrends(
  range?: string,
): Promise<ApiResponse<TrendData>> {
  const res = (await http.get('/dashboard/trends', {
    params: { range },
  })) as unknown as ApiResponse<TrendPoint[]>;
  const points = Array.isArray(res.data) ? res.data : [];
  const pivoted: TrendData = {
    dates: points.map((p) => p.date),
    alerts: points.map((p) => p.alerts ?? 0),
    followups: points.map((p) => p.followups ?? 0),
    assessments: points.map((p) => p.assessments ?? 0),
  };
  return { ...res, data: pivoted };
}
