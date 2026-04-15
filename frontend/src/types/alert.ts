import type { PaginationParams } from './common';

/** Alert entity */
export interface Alert {
  id: number;
  elder_id: number;
  elder_name?: string;
  type: string;
  title: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'resolved' | 'ignored';
  source: string;
  triggered_at: string;
  resolved_at?: string;
  remark?: string;
  created_at?: string;
}

/** Create alert request */
export interface AlertCreate {
  elder_id: number;
  type: string;
  title: string;
  description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

/** Update alert status request */
export interface AlertStatusUpdate {
  status: 'pending' | 'processing' | 'resolved' | 'ignored';
  remark?: string;
}

/** Batch update alert status request */
export interface AlertBatchStatus {
  ids: number[];
  status: 'resolved' | 'ignored';
  remark?: string;
}

/** Alert list query parameters */
export interface AlertListQuery extends PaginationParams {
  elder_id?: number;
  type?: string;
  status?: string;
  risk_level?: string;
  date_start?: string;
  date_end?: string;
}
