/** Types for the ML prediction task workflow. */

export type PredictionTaskStatus =
  | 'pending_elder'
  | 'pending_doctor'
  | 'pending_prediction'
  | 'predicted'
  | 'failed'
  | 'cancelled';

export interface PredictionPayload {
  id: number;
  high_risk_prob: number;
  high_risk: boolean;
  followup_prob: number;
  followup_needed: boolean;
  health_score: number;
  predicted_at?: string | null;
}

export interface FeatureContribution {
  key: string;
  label: string;
  value: number;
  z_score: number;
  direction: 'higher' | 'lower';
}

export interface PredictionTask {
  id: number;
  elder_id: number;
  elder_name?: string | null;
  doctor_user_id: number;
  doctor_name?: string | null;
  title: string;
  message?: string | null;
  status: PredictionTaskStatus;
  auto_inputs?: Record<string, number | string | null> | null;
  permanent_inputs?: Record<string, number | string | null> | null;
  doctor_inputs?: Record<string, number | string | null> | null;
  elder_requested_fields: string[];
  elder_inputs?: Record<string, number | string | null> | null;
  features_snapshot?: Record<string, number | string | null> | null;
  prediction_result_id?: number | null;
  error_message?: string | null;
  due_at?: string | null;
  elder_submitted_at?: string | null;
  predicted_at?: string | null;
  created_at: string;
  updated_at: string;
  prediction?: PredictionPayload | null;
  contributions?: FeatureContribution[] | null;
}

export interface InputsPreview {
  elder_id: number;
  elder_name?: string | null;
  auto_inputs: Record<string, number | string | null>;
  permanent_inputs: Record<string, number | string | null>;
  doctor_keys: string[];
  elder_keys: string[];
  missing_required: string[];
}

export interface PredictionTaskCreateRequest {
  elder_id: number;
  title?: string;
  message?: string;
  doctor_inputs?: Record<string, number | null>;
  due_at?: string;
}

export interface PredictionTaskBatchCreateRequest {
  elder_ids: number[];
  title?: string;
  message?: string;
  doctor_inputs?: Record<string, number | null>;
  due_at?: string;
}

export interface PredictionTaskElderSubmitRequest {
  responses: Record<string, number | string>;
}

export interface PredictionTaskBatchCreateResponse {
  items: PredictionTask[];
  missing_elder_ids: number[];
  total: number;
}
