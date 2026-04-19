/** Types for doctor-dispatched survey tasks and the feature catalog. */

export type SurveyStatus = 'pending' | 'submitted' | 'cancelled';

export interface SurveyTask {
  id: number;
  elder_id: number;
  elder_name?: string | null;
  doctor_user_id: number;
  doctor_name?: string | null;
  title: string;
  message?: string | null;
  requested_fields: string[];
  responses?: Record<string, number | string> | null;
  status: SurveyStatus;
  due_at?: string | null;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyCreateRequest {
  elder_id: number;
  requested_fields: string[];
  title?: string;
  message?: string;
  due_at?: string;
}

export interface SurveySubmitRequest {
  responses: Record<string, number | string>;
}

export type FeatureFieldType = 'number' | 'enum' | 'boolean';
export type FeatureFiller = 'auto' | 'doctor' | 'elder';
export type FeatureSourceKind =
  | 'profile'
  | 'health_record'
  | 'static'
  | 'dynamic';

export interface FeatureCatalogEntry {
  key: string;
  label: string;
  unit?: string;
  type: FeatureFieldType;
  min?: number;
  max?: number;
  options?: { value: number; label: string }[];
  description: string;
  /** Who fills the value. */
  filler: FeatureFiller;
  /** How values persist / stay fresh. */
  source_kind: FeatureSourceKind;
  /** Whether inference needs this field (otherwise mean-imputed). */
  required: boolean;
  /** Hidden from UI forms (derived/internal). */
  hidden?: boolean;
  /** Auxiliary input outside FEATURE_COLS (feeds a derived feature). */
  auxiliary?: boolean;
}
