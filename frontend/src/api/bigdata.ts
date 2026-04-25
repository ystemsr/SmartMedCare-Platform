import http from './http';
import type { ApiResponse } from '../types/common';
import type {
  AnalyticsFollowupCompletion,
  AnalyticsPipelineHealth,
  AnalyticsPredictionTrend,
  AnalyticsRegionalBreakdown,
  AnalyticsRiskDistribution,
  HdfsListResponse,
  HdfsPreviewResponse,
  HiveQueryHistoryEntry,
  HiveQueryRequest,
  HiveQueryResponse,
  HiveSavedQuery,
  Job,
  JobDetail,
  JobListQuery,
  JobSubmitRequest,
  JobSubmitResponse,
  MLFeaturePayload,
  PipelineFreshness,
  PipelineRunResult,
  PipelineSchedule,
  PipelineScheduleUpdate,
  Prediction,
  PredictionRecord,
} from '../types/bigdata';

// ---------- Jobs ----------

export function submitJob(
  data: JobSubmitRequest,
): Promise<ApiResponse<JobSubmitResponse>> {
  return http.post('/bigdata/jobs', data);
}

export function getJobs(
  params: JobListQuery & {
    status?: string;
    job_type?: string;
    submitted_by?: number;
    date_from?: string;
    date_to?: string;
  } = {},
): Promise<ApiResponse<{ items: Job[]; total: number }>> {
  return http.get('/bigdata/jobs', { params });
}

export function getJobDetail(jobId: string): Promise<ApiResponse<JobDetail>> {
  return http.get(`/bigdata/jobs/${jobId}`);
}

export function cancelJob(jobId: string): Promise<ApiResponse<{ ok: boolean }>> {
  return http.post(`/bigdata/jobs/${jobId}/cancel`);
}

export function retryJob(jobId: string): Promise<ApiResponse<Job>> {
  return http.post(`/bigdata/jobs/${jobId}/retry`);
}

/** Returns an absolute URL for downloading the raw log file. */
export function jobLogDownloadUrl(jobId: string): string {
  return `/api/v1/bigdata/jobs/${jobId}/log`;
}

// ---------- HDFS ----------

export function listHdfs(path: string): Promise<ApiResponse<HdfsListResponse>> {
  return http.get('/bigdata/hdfs/list', { params: { path } });
}

export function previewHdfs(
  path: string,
  lines = 200,
): Promise<ApiResponse<HdfsPreviewResponse>> {
  return http.get('/bigdata/hdfs/preview', { params: { path, lines } });
}

// ---------- Hive ----------

export function runHiveQuery(
  data: HiveQueryRequest,
): Promise<ApiResponse<HiveQueryResponse & { duration_ms?: number; truncated?: boolean }>> {
  return http.post('/bigdata/hive/query', data);
}

/** Returns an absolute URL (POST) for CSV export. */
export const hiveExportUrl = '/api/v1/bigdata/hive/export';

export function getHiveHistory(
  limit = 50,
): Promise<ApiResponse<{ items: HiveQueryHistoryEntry[]; total: number }>> {
  return http.get('/bigdata/hive/history', { params: { limit } });
}

export function listSavedQueries(): Promise<
  ApiResponse<{ items: HiveSavedQuery[]; total: number }>
> {
  return http.get('/bigdata/hive/saved');
}

export function createSavedQuery(data: {
  name: string;
  sql: string;
  description?: string;
}): Promise<ApiResponse<HiveSavedQuery>> {
  return http.post('/bigdata/hive/saved', data);
}

export function updateSavedQuery(
  id: number,
  data: { name?: string; sql?: string; description?: string },
): Promise<ApiResponse<HiveSavedQuery>> {
  return http.put(`/bigdata/hive/saved/${id}`, data);
}

export function deleteSavedQuery(
  id: number,
): Promise<ApiResponse<{ id: number; deleted: boolean }>> {
  return http.delete(`/bigdata/hive/saved/${id}`);
}

// ---------- ML (read-only helpers; writes go through prediction tasks) ----------

export function getElderFeaturePayload(
  elderId: number,
): Promise<ApiResponse<MLFeaturePayload>> {
  return http.get(`/bigdata/ml/features/${elderId}`);
}

export function getLatestPrediction(
  elderId: number,
): Promise<ApiResponse<Prediction>> {
  return http.get(`/bigdata/ml/predictions/${elderId}`);
}

export function getPredictionHistory(
  elderId: number,
  limit = 30,
): Promise<ApiResponse<{ items: PredictionRecord[]; total: number }>> {
  return http.get(`/bigdata/ml/predictions/${elderId}/history`, {
    params: { limit },
  });
}

// ---------- Analytics ----------

export function getRiskDistribution(): Promise<
  ApiResponse<AnalyticsRiskDistribution>
> {
  return http.get('/bigdata/analytics/risk-distribution');
}

export function getFollowupCompletion(
  days = 30,
): Promise<ApiResponse<AnalyticsFollowupCompletion>> {
  return http.get('/bigdata/analytics/followup-completion', {
    params: { days },
  });
}

export function getRegionalBreakdown(): Promise<
  ApiResponse<AnalyticsRegionalBreakdown>
> {
  return http.get('/bigdata/analytics/regional-breakdown');
}

export function getPipelineHealth(): Promise<
  ApiResponse<AnalyticsPipelineHealth>
> {
  return http.get('/bigdata/analytics/pipeline-health');
}

export function getPredictionTrend(
  days = 30,
): Promise<ApiResponse<AnalyticsPredictionTrend>> {
  return http.get('/bigdata/analytics/prediction-trend', { params: { days } });
}

// ---------- Pipeline (business-facing freshness) ----------

export function getPipelineFreshness(): Promise<ApiResponse<PipelineFreshness>> {
  return http.get('/bigdata/pipeline/freshness');
}

export function runPipeline(): Promise<ApiResponse<PipelineRunResult>> {
  return http.post('/bigdata/pipeline/run');
}

export function updatePipelineSchedule(
  body: PipelineScheduleUpdate,
): Promise<ApiResponse<PipelineSchedule>> {
  return http.put('/bigdata/pipeline/schedule', body);
}

export function getAnalyticsOverview(): Promise<
  ApiResponse<{
    elder_total: number;
    high_risk_total: number;
    medium_risk_total: number;
    pending_alert_total: number;
    source?: string;
  }>
> {
  return http.get('/bigdata/analytics/overview');
}
