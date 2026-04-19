/** Big data module types */

export type JobType = 'mysql_to_hdfs' | 'build_marts' | 'batch_predict' | 'custom_hive';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface Job {
  job_id: string;
  job_type: JobType;
  status: JobStatus;
  started_at: string | null;
  finished_at: string | null;
  params?: Record<string, unknown> | null;
  duration_ms?: number | null;
  rows_processed?: number | null;
  submitted_by?: number | null;
}

export interface JobDetail extends Job {
  log_tail?: string[];
  logs?: string;
}

export interface JobListQuery {
  page?: number;
  page_size?: number;
}

export interface JobSubmitRequest {
  job_type: JobType;
  params?: Record<string, unknown>;
}

export interface JobSubmitResponse {
  job_id: string;
  status: JobStatus;
}

export interface HdfsEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
}

export interface HdfsListResponse {
  entries: HdfsEntry[];
}

export interface HdfsPreviewResponse {
  content: string;
}

export interface HiveQueryRequest {
  sql: string;
  limit?: number;
}

export interface HiveQueryResponse {
  columns: string[];
  rows: unknown[][];
}

/** Feature dictionary used for ML inference */
export interface FeatureDict {
  AGE: number;
  IS_FEMALE: number;
  RACE: number;
  SCHLYRS: number;
  SELF_HEALTH: number;
  HEALTH_CHANGE: number;
  FALL_2YR: number;
  PAIN: number;
  BMI_CATEGORY: number;
  MEMORY_RATING: number;
  MEMORY_CHANGE: number;
  SERIAL7_SCORE: number;
  DATE_NAMING: number;
  ADL_SCORE: number;
  HOSPITAL_STAY: number;
  NURSING_HOME: number;
  HOME_HEALTH: number;
  HAS_USUAL_CARE: number;
  NUM_HOSPITAL_STAYS: number;
  DOCTOR_VISITS: number;
}

export interface Prediction {
  high_risk_prob: number;
  high_risk: boolean;
  followup_prob: number;
  followup_needed: boolean;
  health_score: number;
}

/** Historical prediction record entry */
export interface PredictionRecord {
  id: number;
  elder_id: number;
  predicted_at: string;
  high_risk_prob: number;
  followup_prob: number;
  high_risk: boolean;
  followup_needed: boolean;
  health_score: number;
}

/** Feature contribution breakdown returned with a prediction. */
export interface FeatureContribution {
  key: string;
  label: string;
  value: number;
  z_score: number;
  direction: 'higher' | 'lower';
}

/** Predict + attribution response. */
export interface PredictionWithContributions extends Prediction {
  contributions?: FeatureContribution[];
}

/** Autofill payload for an elder before running inference. */
export interface MLFeaturePayload {
  elder_id: number;
  features: Record<string, number | null>;
  sources: Record<string, 'elder' | 'health_record' | 'survey' | null>;
  missing: string[];
}

/** Response of POST /ml/predict_by_elder. */
export interface PredictByElderResponse extends PredictionWithContributions {
  used_features: Record<string, number>;
  sources: Record<string, 'elder' | 'health_record' | 'survey' | null>;
  missing_before_overrides: string[];
}

export interface HiveSavedQuery {
  id: number;
  user_id: number;
  name: string;
  sql: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HiveQueryHistoryEntry {
  id: number;
  user_id: number;
  sql: string;
  row_count: number;
  duration_ms: number;
  status: 'success' | 'failed';
  error_message?: string | null;
  created_at: string;
}

export interface AnalyticsRiskDistribution {
  items: { key: string; label: string; count: number }[];
  total: number;
}

export interface AnalyticsFollowupCompletion {
  items: { date: string; todo: number; in_progress: number; completed: number }[];
  days: number;
}

export interface AnalyticsRegionalBreakdown {
  items: { region: string; count: number }[];
}

export interface AnalyticsPipelineHealth {
  items: {
    stage: string;
    status: string;
    job_id: string | null;
    duration_ms?: number | null;
    rows_processed?: number | null;
    finished_at?: string | null;
  }[];
}

export interface AnalyticsPredictionTrend {
  items: {
    date: string;
    avg_health_score: number;
    high_risk_count: number;
    total: number;
  }[];
  days: number;
}
