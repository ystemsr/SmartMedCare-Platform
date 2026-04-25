import http from './http';

/** Fields an elder is allowed to edit on their own profile. */
export interface ElderSelfUpdatePayload {
  phone?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

/** Get elder's own profile */
export function getElderSelf() {
  return http.get('/elders/me');
}

/** Update the current elder's contact details */
export function updateElderSelf(payload: ElderSelfUpdatePayload) {
  return http.put('/elders/me', payload);
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

/** Get followups for the given elder. */
export function getElderFollowups(elderId: number, params?: Record<string, unknown>) {
  return http.get('/followups', { params: { elder_id: elderId, ...(params || {}) } });
}

export interface WeatherInfo {
  city?: string | null;
  description?: string | null;
  icon?: string | null;
  main?: string | null;
  temp?: number | null;
  feels_like?: number | null;
  temp_min?: number | null;
  temp_max?: number | null;
  humidity?: number | null;
  wind_speed?: number | null;
}

/** Get current weather from the backend cache (refreshed on a schedule). */
export function getCurrentWeather() {
  return http.get('/weather/current');
}
