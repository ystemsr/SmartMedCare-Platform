import http from './http';
import type { ApiResponse } from '../types/common';

export interface KBRolesResponse {
  roles: string[];
  supported_extensions: string[];
}

export interface KBDocument {
  id: number;
  role_code: string;
  name: string;
  file_type: string;
  size: number;
  status: string;
  error_message?: string | null;
  chunk_count: number;
  uploaded_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface KBDocumentList {
  items: KBDocument[];
}

export interface KBUploadResult {
  name: string;
  ok: boolean;
  error?: string | null;
  document?: KBDocument | null;
}

export interface KBUploadBatchResponse {
  items: KBUploadResult[];
}

export interface KBPreviewHit {
  document_id: number | null;
  document_name: string;
  chunk_index: number | null;
  score: number;
  content: string;
}

export interface KBPreviewResponse {
  hits: KBPreviewHit[];
}

export function getKBRoles(): Promise<ApiResponse<KBRolesResponse>> {
  return http.get('/ai/kb/roles');
}

export function listKBDocuments(
  roleCode?: string,
): Promise<ApiResponse<KBDocumentList>> {
  return http.get('/ai/kb/documents', {
    params: roleCode ? { role_code: roleCode } : undefined,
  });
}

export function uploadKBDocuments(
  roleCode: string,
  files: File[],
): Promise<ApiResponse<KBUploadBatchResponse>> {
  const formData = new FormData();
  formData.append('role_code', roleCode);
  for (const f of files) {
    formData.append('files', f);
  }
  return http.post('/ai/kb/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Embedding runs serially on the backend, so a batch of large
    // documents can take minutes. Give the request plenty of headroom.
    timeout: 600_000,
  });
}

export function deleteKBDocument(
  documentId: number,
): Promise<ApiResponse<null>> {
  return http.delete(`/ai/kb/documents/${documentId}`);
}

export function previewKBSearch(
  roleCode: string,
  q: string,
  topK = 5,
): Promise<ApiResponse<KBPreviewResponse>> {
  return http.get('/ai/kb/preview', {
    params: { role_code: roleCode, q, top_k: topK },
  });
}
