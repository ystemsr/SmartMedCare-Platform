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

export function getTrends(range?: string): Promise<ApiResponse<TrendData>> {
  return http.get('/dashboard/trends', { params: { range } });
}
