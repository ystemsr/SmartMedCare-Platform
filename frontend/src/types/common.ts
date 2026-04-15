/** Unified API response wrapper */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  errors?: { field: string; reason: string }[];
}

/** Paginated data envelope */
export interface PaginatedData<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

/** Common pagination query parameters */
export interface PaginationParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}
