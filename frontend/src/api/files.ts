import http from './http';
import type { ApiResponse } from '../types/common';

export interface FileInfo {
  file_id: number;
  file_name: string;
  object_key: string;
  content_type: string;
  size: number;
  url: string;
}

export interface FileBindRequest {
  biz_type: string;
  biz_id: number;
}

/** Upload file to MinIO */
export function uploadFile(
  file: File,
  category?: string,
  elder_id?: number,
): Promise<ApiResponse<FileInfo>> {
  const formData = new FormData();
  formData.append('file', file);
  if (category) formData.append('category', category);
  if (elder_id) formData.append('elder_id', String(elder_id));
  return http.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** Get file details */
export function getFileDetail(fileId: number): Promise<ApiResponse<FileInfo>> {
  return http.get(`/files/${fileId}`);
}

/** Get presigned download URL */
export function getDownloadUrl(fileId: number): Promise<ApiResponse<{ url: string }>> {
  return http.get(`/files/${fileId}/download-url`);
}

/** Delete a file */
export function deleteFile(fileId: number): Promise<ApiResponse<null>> {
  return http.delete(`/files/${fileId}`);
}

/** Bind a file to a business record */
export function bindFile(fileId: number, data: FileBindRequest): Promise<ApiResponse<null>> {
  return http.post(`/files/${fileId}/bind`, data);
}
