import type { PaginationParams } from './common';

/** Assessment entity */
export interface Assessment {
  id: number;
  elder_id: number;
  elder_name?: string;
  assessment_type?: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  suggestions: string[];
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
}

/** Create assessment request */
export interface AssessmentCreate {
  elder_id: number;
  assessment_type?: string;
  score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  suggestions?: string[];
}

/** Update assessment request */
export interface AssessmentUpdate extends Partial<AssessmentCreate> {}

/** Auto-generate assessment request */
export interface AssessmentGenerate {
  elder_id: number;
  force_recalculate?: boolean;
}

/** Assessment list query parameters */
export interface AssessmentListQuery extends PaginationParams {
  elder_id?: number;
  risk_level?: string;
  assessment_type?: string;
  date_start?: string;
  date_end?: string;
}
