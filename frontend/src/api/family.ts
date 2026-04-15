import http from './http';
import type { ApiResponse, PaginatedData, PaginationParams } from '../types/common';
import type { FamilyMemberAdmin } from '../types/family';

/** List all family members (admin) */
export function getFamilyMembers(params: PaginationParams): Promise<ApiResponse<PaginatedData<FamilyMemberAdmin>>> {
  return http.get('/family/members', { params });
}

/** Validate invite code (public, no auth) */
export function validateInviteCode(code: string) {
  return http.get(`/family/validate-code/${code}`);
}

/** Register family member (public, no auth) */
export function registerFamily(data: {
  invite_code: string;
  real_name: string;
  phone: string;
  password: string;
  relationship: string;
  captcha_token: string;
  session_id: string;
}) {
  return http.post('/family/register', data);
}

/** Get family member's own info */
export function getFamilySelf() {
  return http.get('/family/me');
}

/** Get linked elder info */
export function getFamilyElder() {
  return http.get('/family/elder');
}

/** Get elder's health records (for family viewing) */
export function getElderHealthRecords(elderId: number, params?: Record<string, unknown>) {
  return http.get(`/elders/${elderId}/health-records`, { params });
}

/** Get elder's alerts */
export function getElderAlerts(params?: Record<string, unknown>) {
  return http.get('/alerts', { params });
}
