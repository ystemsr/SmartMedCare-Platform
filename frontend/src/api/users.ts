import http from './http';
import type { ApiResponse, PaginatedData, PaginationParams } from '../types/common';
import type { User, UserCreate, UserUpdate } from '../types/user';

export function getUsers(params: PaginationParams): Promise<ApiResponse<PaginatedData<User>>> {
  return http.get('/users', { params });
}

export function getUserDetail(id: number): Promise<ApiResponse<User>> {
  return http.get(`/users/${id}`);
}

export function createUser(data: UserCreate): Promise<ApiResponse<User>> {
  return http.post('/users', data);
}

export function updateUser(id: number, data: UserUpdate): Promise<ApiResponse<User>> {
  return http.put(`/users/${id}`, data);
}

export function deleteUser(id: number): Promise<ApiResponse<null>> {
  return http.delete(`/users/${id}`);
}
