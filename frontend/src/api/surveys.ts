import http from './http';
import type { ApiResponse } from '../types/common';
import type {
  FeatureCatalogEntry,
  SurveyCreateRequest,
  SurveySubmitRequest,
  SurveyStatus,
  SurveyTask,
} from '../types/survey';

export function createSurvey(
  data: SurveyCreateRequest,
): Promise<ApiResponse<SurveyTask>> {
  return http.post('/surveys', data);
}

export function listDoctorSurveys(params: {
  elder_id?: number;
  status?: SurveyStatus;
  limit?: number;
} = {}): Promise<ApiResponse<{ items: SurveyTask[]; total: number }>> {
  return http.get('/surveys', { params });
}

export function listMySurveys(params: {
  status?: SurveyStatus;
  limit?: number;
} = {}): Promise<ApiResponse<{ items: SurveyTask[]; total: number }>> {
  return http.get('/surveys/my', { params });
}

export function getSurvey(id: number): Promise<ApiResponse<SurveyTask>> {
  return http.get(`/surveys/${id}`);
}

export function submitSurvey(
  id: number,
  data: SurveySubmitRequest,
): Promise<ApiResponse<SurveyTask>> {
  return http.post(`/surveys/${id}/submit`, data);
}

export function cancelSurvey(id: number): Promise<ApiResponse<SurveyTask>> {
  return http.post(`/surveys/${id}/cancel`);
}

export function getFeatureCatalog(): Promise<
  ApiResponse<{ items: FeatureCatalogEntry[] }>
> {
  return http.get('/surveys/catalog');
}
