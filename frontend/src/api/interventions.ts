import http from './http';
import type { ApiResponse, PaginatedData } from '../types/common';
import type {
  Intervention,
  InterventionCreate,
  InterventionUpdate,
  InterventionStatusUpdate,
  InterventionListQuery,
} from '../types/intervention';

export function getInterventions(
  params: InterventionListQuery,
): Promise<ApiResponse<PaginatedData<Intervention>>> {
  return http.get('/interventions', { params });
}

export function getInterventionDetail(id: number): Promise<ApiResponse<Intervention>> {
  return http.get(`/interventions/${id}`);
}

export function createIntervention(
  data: InterventionCreate,
): Promise<ApiResponse<Intervention>> {
  return http.post('/interventions', data);
}

export function updateIntervention(
  id: number,
  data: InterventionUpdate,
): Promise<ApiResponse<Intervention>> {
  return http.put(`/interventions/${id}`, data);
}

export function updateInterventionStatus(
  id: number,
  data: InterventionStatusUpdate,
): Promise<ApiResponse<null>> {
  return http.patch(`/interventions/${id}/status`, data);
}

export function deleteIntervention(id: number): Promise<ApiResponse<null>> {
  return http.delete(`/interventions/${id}`);
}
