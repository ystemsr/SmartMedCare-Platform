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
  feature_inputs?: Record<string, number | null> | null;
  prediction_result_id?: number | null;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
}

/** Create assessment request.
 * When `feature_inputs` is provided the server runs the 20-feature ML model
 * and derives `score`/`risk_level`/`summary`/`suggestions` from its output,
 * so those four fields may be omitted by the caller in AI mode. */
export interface AssessmentCreate {
  elder_id: number;
  assessment_type?: string;
  score?: number;
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  summary?: string;
  suggestions?: string[];
  feature_inputs?: Record<string, number | null>;
}

/** Prefill payload returned by GET /assessments/prefill/{elder_id}. */
export interface AssessmentPrefill {
  auto_inputs: Record<string, number | null>;
  permanent_inputs: Record<string, number | null>;
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
