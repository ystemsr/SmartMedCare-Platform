import http from './http';
import type { ApiResponse, PaginatedData } from '../types/common';
import type {
  Alert,
  AlertCreate,
  AlertStatusUpdate,
  AlertBatchStatus,
  AlertListQuery,
} from '../types/alert';

export function getAlerts(params: AlertListQuery): Promise<ApiResponse<PaginatedData<Alert>>> {
  return http.get('/alerts', { params });
}

export function getAlertDetail(id: number): Promise<ApiResponse<Alert>> {
  return http.get(`/alerts/${id}`);
}

export function createAlert(data: AlertCreate): Promise<ApiResponse<Alert>> {
  return http.post('/alerts', data);
}

export function updateAlertStatus(
  id: number,
  data: AlertStatusUpdate,
): Promise<ApiResponse<null>> {
  return http.patch(`/alerts/${id}/status`, data);
}

export function batchUpdateAlertStatus(data: AlertBatchStatus): Promise<ApiResponse<null>> {
  return http.post('/alerts/batch-status', data);
}

export function recheckAlerts(elder_id: number): Promise<ApiResponse<null>> {
  return http.post('/alerts/recheck', { elder_id });
}
