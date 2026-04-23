import http from './http';
import type { ApiResponse, PaginatedData } from '../types/common';
import type {
  Assessment,
  AssessmentCreate,
  AssessmentUpdate,
  AssessmentListQuery,
  AssessmentPrefill,
} from '../types/assessment';
import type { FeatureCatalogEntry } from '../types/survey';

export function getAssessments(
  params: AssessmentListQuery,
): Promise<ApiResponse<PaginatedData<Assessment>>> {
  return http.get('/assessments', { params });
}

export function getAssessmentDetail(id: number): Promise<ApiResponse<Assessment>> {
  return http.get(`/assessments/${id}`);
}

export function createAssessment(data: AssessmentCreate): Promise<ApiResponse<Assessment>> {
  return http.post('/assessments', data);
}

export function updateAssessment(
  id: number,
  data: AssessmentUpdate,
): Promise<ApiResponse<Assessment>> {
  return http.put(`/assessments/${id}`, data);
}

export function deleteAssessment(id: number): Promise<ApiResponse<null>> {
  return http.delete(`/assessments/${id}`);
}

export function getAssessmentFeatureCatalog(): Promise<
  ApiResponse<{ items: FeatureCatalogEntry[] }>
> {
  return http.get('/assessments/feature-catalog');
}

export function getAssessmentPrefill(
  elderId: number,
): Promise<ApiResponse<AssessmentPrefill>> {
  return http.get(`/assessments/prefill/${elderId}`);
}
