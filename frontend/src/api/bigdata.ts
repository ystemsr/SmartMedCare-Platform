import http from './http';
import type { ApiResponse } from '../types/common';
import type {
  FeatureDict,
  HdfsListResponse,
  HdfsPreviewResponse,
  HiveQueryRequest,
  HiveQueryResponse,
  Job,
  JobDetail,
  JobListQuery,
  JobSubmitRequest,
  JobSubmitResponse,
  Prediction,
} from '../types/bigdata';

/** Submit a new data job */
export function submitJob(data: JobSubmitRequest): Promise<ApiResponse<JobSubmitResponse>> {
  return http.post('/bigdata/jobs', data);
}

/** List jobs with pagination */
export function getJobs(
  params: JobListQuery = {},
): Promise<ApiResponse<{ items: Job[]; total: number }>> {
  return http.get('/bigdata/jobs', { params });
}

/** Get a job's detail including logs */
export function getJobDetail(jobId: string): Promise<ApiResponse<JobDetail>> {
  return http.get(`/bigdata/jobs/${jobId}`);
}

/** Cancel a running job */
export function cancelJob(jobId: string): Promise<ApiResponse<{ ok: boolean }>> {
  return http.post(`/bigdata/jobs/${jobId}/cancel`);
}

/** List entries under an HDFS path */
export function listHdfs(path: string): Promise<ApiResponse<HdfsListResponse>> {
  return http.get('/bigdata/hdfs/list', { params: { path } });
}

/** Preview first N lines of an HDFS file */
export function previewHdfs(path: string, lines = 200): Promise<ApiResponse<HdfsPreviewResponse>> {
  return http.get('/bigdata/hdfs/preview', { params: { path, lines } });
}

/** Execute a Hive SELECT query */
export function runHiveQuery(data: HiveQueryRequest): Promise<ApiResponse<HiveQueryResponse>> {
  return http.post('/bigdata/hive/query', data);
}

/** Single-record ML prediction */
export function predictOne(features: FeatureDict): Promise<ApiResponse<Prediction>> {
  return http.post('/bigdata/ml/predict', features);
}

/** Batch ML prediction */
export function predictBatch(features: FeatureDict[]): Promise<ApiResponse<Prediction[]>> {
  return http.post('/bigdata/ml/predict/batch', features);
}

/** Get the latest prediction for an elder */
export function getLatestPrediction(elderId: number): Promise<ApiResponse<Prediction>> {
  return http.get(`/bigdata/ml/predictions/${elderId}`);
}
