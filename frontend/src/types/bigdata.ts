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
}

export interface JobDetail extends Job {
  logs: string;
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
