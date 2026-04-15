import type { PaginationParams } from './common';

/** Intervention entity */
export interface Intervention {
  id: number;
  elder_id: number;
  elder_name?: string;
  followup_id?: number;
  type: string;
  status: 'planned' | 'ongoing' | 'completed' | 'stopped';
  content: string;
  result?: string;
  performed_by?: number;
  performed_by_name?: string;
  performed_at?: string;
  planned_at?: string;
  created_at?: string;
  updated_at?: string;
}

/** Create intervention request */
export interface InterventionCreate {
  elder_id: number;
  followup_id?: number;
  type: string;
  status?: string;
  content: string;
  planned_at?: string;
}

/** Update intervention request */
export interface InterventionUpdate extends Partial<InterventionCreate> {}

/** Update intervention status request */
export interface InterventionStatusUpdate {
  status: 'planned' | 'ongoing' | 'completed' | 'stopped';
  result?: string;
}

/** Intervention list query parameters */
export interface InterventionListQuery extends PaginationParams {
  elder_id?: number;
  status?: string;
  type?: string;
}
