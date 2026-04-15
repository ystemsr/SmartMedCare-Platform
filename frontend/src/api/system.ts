import http from './http';
import type { ApiResponse, PaginatedData, PaginationParams } from '../types/common';
import type { Role, RoleCreate, PermissionNode } from '../types/user';

// --- Roles ---

export function getRoles(params?: PaginationParams): Promise<ApiResponse<PaginatedData<Role>>> {
  return http.get('/roles', { params });
}

export function createRole(data: RoleCreate): Promise<ApiResponse<Role>> {
  return http.post('/roles', data);
}

export function updateRolePermissions(
  roleId: number,
  permissions: string[],
): Promise<ApiResponse<null>> {
  return http.put(`/roles/${roleId}/permissions`, { permissions });
}

// --- Permissions ---

export function getPermissionsTree(): Promise<ApiResponse<PermissionNode[]>> {
  return http.get('/permissions/tree');
}

// --- System configs ---

export function getSystemConfigs(): Promise<ApiResponse<Record<string, string>>> {
  return http.get('/system/configs');
}

export function updateSystemConfig(
  key: string,
  value: string,
): Promise<ApiResponse<null>> {
  return http.put(`/system/configs/${key}`, { value });
}

// --- Audit logs ---

export interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  resource: string;
  resource_id?: number;
  detail?: string;
  ip?: string;
  created_at: string;
}

export function getAuditLogs(
  params: PaginationParams,
): Promise<ApiResponse<PaginatedData<AuditLog>>> {
  return http.get('/system/audit-logs', { params });
}

// --- Login logs ---

export interface LoginLog {
  id: number;
  user_id: number;
  username: string;
  ip: string;
  user_agent?: string;
  status: string;
  created_at: string;
}

export function getLoginLogs(
  params: PaginationParams,
): Promise<ApiResponse<PaginatedData<LoginLog>>> {
  return http.get('/system/login-logs', { params });
}

// --- Health check ---

export interface HealthStatus {
  app: string;
  mysql: string;
  redis: string;
  minio: string;
  timestamp: string;
}

export function getHealthCheck(): Promise<ApiResponse<HealthStatus>> {
  return http.get('/system/health');
}
