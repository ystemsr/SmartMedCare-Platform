import type { PaginationParams } from './common';

/** Follow-up plan entity */
export interface Followup {
  id: number;
  elder_id: number;
  elder_name?: string;
  alert_id?: number;
  plan_type: string;
  planned_at: string;
  status: 'todo' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  assigned_to: number;
  assigned_to_name?: string;
  notes?: string;
  alert_source?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Create follow-up request */
export interface FollowupCreate {
  elder_id: number;
  alert_id?: number;
  plan_type: string;
  planned_at: string;
  assigned_to: number;
  notes?: string;
}

/** Update follow-up request */
export interface FollowupUpdate extends Partial<FollowupCreate> {}

/** Follow-up record (result of a visit) */
export interface FollowupRecord {
  id: number;
  followup_id: number;
  actual_time: string;
  result: string;
  next_action?: string;
  status: string;
  created_at?: string;
}

/** Create follow-up record request */
export interface FollowupRecordCreate {
  actual_time: string;
  result: string;
  next_action?: string;
  status: string;
}

/** Update follow-up status request */
export interface FollowupStatusUpdate {
  status: 'todo' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
}

/** Follow-up list query parameters */
export interface FollowupListQuery extends PaginationParams {
  elder_id?: number;
  assigned_to?: number;
  status?: string;
  plan_type?: string;
  date_start?: string;
  date_end?: string;
}
