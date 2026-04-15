import http from './http';
import type { ApiResponse, PaginatedData } from '../types/common';
import type {
  Followup,
  FollowupCreate,
  FollowupUpdate,
  FollowupRecord,
  FollowupRecordCreate,
  FollowupStatusUpdate,
  FollowupListQuery,
} from '../types/followup';

export function getFollowups(
  params: FollowupListQuery,
): Promise<ApiResponse<PaginatedData<Followup>>> {
  return http.get('/followups', { params });
}

export function getFollowupDetail(id: number): Promise<ApiResponse<Followup>> {
  return http.get(`/followups/${id}`);
}

export function createFollowup(data: FollowupCreate): Promise<ApiResponse<Followup>> {
  return http.post('/followups', data);
}

export function updateFollowup(
  id: number,
  data: FollowupUpdate,
): Promise<ApiResponse<Followup>> {
  return http.put(`/followups/${id}`, data);
}

export function deleteFollowup(id: number): Promise<ApiResponse<null>> {
  return http.delete(`/followups/${id}`);
}

export function addFollowupRecord(
  followupId: number,
  data: FollowupRecordCreate,
): Promise<ApiResponse<FollowupRecord>> {
  return http.post(`/followups/${followupId}/records`, data);
}

export function updateFollowupStatus(
  id: number,
  data: FollowupStatusUpdate,
): Promise<ApiResponse<null>> {
  return http.patch(`/followups/${id}/status`, data);
}
