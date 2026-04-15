import http from './http';
import type { ApiResponse, PaginatedData, PaginationParams } from '../types/common';
import type {
  Elder,
  ElderCreate,
  ElderUpdate,
  ElderListQuery,
  ElderTag,
  HealthRecord,
  HealthRecordCreate,
  MedicalRecord,
  MedicalRecordCreate,
  CareRecord,
  CareRecordCreate,
} from '../types/elder';

// --- Elder CRUD ---

export function getElders(params: ElderListQuery): Promise<ApiResponse<PaginatedData<Elder>>> {
  return http.get('/elders', { params });
}

export function getElderDetail(id: number): Promise<ApiResponse<Elder>> {
  return http.get(`/elders/${id}`);
}

export function createElder(data: ElderCreate): Promise<ApiResponse<Elder>> {
  return http.post('/elders', data);
}

export function updateElder(id: number, data: ElderUpdate): Promise<ApiResponse<Elder>> {
  return http.put(`/elders/${id}`, data);
}

export function deleteElder(id: number): Promise<ApiResponse<null>> {
  return http.delete(`/elders/${id}`);
}

// --- Elder account operations ---

export function resetElderPassword(elderId: number): Promise<ApiResponse<null>> {
  return http.post(`/elders/${elderId}/reset-password`);
}

export function updateElderAccountStatus(
  elderId: number,
  account_status: string,
): Promise<ApiResponse<null>> {
  return http.post(`/elders/${elderId}/account-status`, { account_status });
}

// --- Tags ---

export function getElderTags(): Promise<ApiResponse<ElderTag[]>> {
  return http.get('/elders/tags');
}

// --- Health records ---

export function getHealthRecords(
  elderId: number,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedData<HealthRecord>>> {
  return http.get(`/elders/${elderId}/health-records`, { params });
}

export function getHealthRecordDetail(
  elderId: number,
  recordId: number,
): Promise<ApiResponse<HealthRecord>> {
  return http.get(`/elders/${elderId}/health-records/${recordId}`);
}

export function createHealthRecord(
  elderId: number,
  data: HealthRecordCreate,
): Promise<ApiResponse<HealthRecord>> {
  return http.post(`/elders/${elderId}/health-records`, data);
}

export function updateHealthRecord(
  elderId: number,
  recordId: number,
  data: Partial<HealthRecordCreate>,
): Promise<ApiResponse<HealthRecord>> {
  return http.put(`/elders/${elderId}/health-records/${recordId}`, data);
}

export function deleteHealthRecord(
  elderId: number,
  recordId: number,
): Promise<ApiResponse<null>> {
  return http.delete(`/elders/${elderId}/health-records/${recordId}`);
}

export function importHealthRecords(elderId: number, file: File): Promise<ApiResponse<null>> {
  const formData = new FormData();
  formData.append('file', file);
  return http.post(`/elders/${elderId}/health-records/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// --- Medical records ---

export function getMedicalRecords(
  elderId: number,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedData<MedicalRecord>>> {
  return http.get(`/elders/${elderId}/medical-records`, { params });
}

export function createMedicalRecord(
  elderId: number,
  data: MedicalRecordCreate,
): Promise<ApiResponse<MedicalRecord>> {
  return http.post(`/elders/${elderId}/medical-records`, data);
}

// --- Care records ---

export function getCareRecords(
  elderId: number,
  params?: PaginationParams,
): Promise<ApiResponse<PaginatedData<CareRecord>>> {
  return http.get(`/elders/${elderId}/care-records`, { params });
}

export function createCareRecord(
  elderId: number,
  data: CareRecordCreate,
): Promise<ApiResponse<CareRecord>> {
  return http.post(`/elders/${elderId}/care-records`, data);
}
