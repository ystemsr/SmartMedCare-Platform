import http from './http';
import type { ApiResponse } from '../types/common';
import type { FeatureCatalogEntry } from '../types/survey';
import type {
  InputsPreview,
  PredictionTask,
  PredictionTaskBatchCreateRequest,
  PredictionTaskBatchCreateResponse,
  PredictionTaskCreateRequest,
  PredictionTaskElderSubmitRequest,
  PredictionTaskStatus,
} from '../types/prediction';

// ---------- Doctor side ----------

export function previewInputs(
  elderId: number,
): Promise<ApiResponse<InputsPreview>> {
  return http.get(`/bigdata/predictions/preview/${elderId}`);
}

export function createPredictionTask(
  data: PredictionTaskCreateRequest,
): Promise<ApiResponse<PredictionTask>> {
  return http.post('/bigdata/predictions/tasks', data);
}

export function batchCreatePredictionTasks(
  data: PredictionTaskBatchCreateRequest,
): Promise<ApiResponse<PredictionTaskBatchCreateResponse>> {
  return http.post('/bigdata/predictions/tasks/batch', data);
}

export function listPredictionTasks(params: {
  elder_id?: number;
  status?: PredictionTaskStatus | string;
  limit?: number;
} = {}): Promise<ApiResponse<{ items: PredictionTask[]; total: number }>> {
  return http.get('/bigdata/predictions/tasks', { params });
}

export function getPredictionTask(
  id: number,
): Promise<ApiResponse<PredictionTask>> {
  return http.get(`/bigdata/predictions/tasks/${id}`);
}

export function cancelPredictionTask(
  id: number,
): Promise<ApiResponse<PredictionTask>> {
  return http.post(`/bigdata/predictions/tasks/${id}/cancel`);
}

export function updateDoctorInputs(
  id: number,
  doctor_inputs: Record<string, number | null>,
): Promise<ApiResponse<PredictionTask>> {
  return http.post(`/bigdata/predictions/tasks/${id}/doctor_update`, {
    doctor_inputs,
  });
}

// ---------- Elder side ----------

export function listMyPredictionTasks(params: {
  status?: PredictionTaskStatus | string;
  limit?: number;
} = {}): Promise<ApiResponse<{ items: PredictionTask[]; total: number }>> {
  return http.get('/bigdata/predictions/tasks/my', { params });
}

export function elderSubmitPredictionTask(
  id: number,
  data: PredictionTaskElderSubmitRequest,
): Promise<ApiResponse<PredictionTask>> {
  return http.post(`/bigdata/predictions/tasks/${id}/elder_submit`, data);
}

// ---------- Catalog passthrough ----------

export function getPredictionCatalog(): Promise<
  ApiResponse<{ items: FeatureCatalogEntry[] }>
> {
  return http.get('/bigdata/predictions/catalog');
}
