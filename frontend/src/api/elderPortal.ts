import http from './http';

/** Get elder's own profile */
export function getElderSelf() {
  return http.get('/elders/me');
}

/** Get elder's family members */
export function getElderFamily() {
  return http.get('/elders/me/family');
}

/** Get active invite code */
export function getInviteCode(elderId: number) {
  return http.get(`/elders/${elderId}/invite-code`);
}

/** Generate invite code */
export function generateInviteCode(elderId: number) {
  return http.post(`/elders/${elderId}/invite-code`);
}

/** Revoke invite code */
export function revokeInviteCode(elderId: number) {
  return http.delete(`/elders/${elderId}/invite-code`);
}

/** Get elder health records (reuse from elders API) */
export function getElderHealthRecords(elderId: number, params?: Record<string, unknown>) {
  return http.get(`/elders/${elderId}/health-records`, { params });
}

/** Get elder alerts */
export function getElderAlerts(params?: Record<string, unknown>) {
  return http.get('/alerts', { params });
}
