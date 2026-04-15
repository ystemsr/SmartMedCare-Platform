import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import type { PaginatedData, ApiResponse } from '../types/common';

interface UseTableOptions<TQuery> {
  defaultPageSize?: number;
  defaultQuery?: Partial<TQuery>;
}

interface UseTableReturn<TItem, TQuery> {
  data: TItem[];
  loading: boolean;
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger: boolean;
    showTotal: (total: number) => string;
  };
  query: TQuery;
  setQuery: React.Dispatch<React.SetStateAction<TQuery>>;
  handleTableChange: (pagination: { current?: number; pageSize?: number }) => void;
  refresh: () => void;
  handleSearch: (keyword: string) => void;
}

/**
 * Generic hook for paginated table data.
 * @param fetchFn - API function that returns paginated data
 * @param options - default page size and query overrides
 */
export function useTable<TItem, TQuery extends Record<string, unknown> = Record<string, unknown>>(
  fetchFn: (params: TQuery & { page: number; page_size: number }) => Promise<ApiResponse<PaginatedData<TItem>>>,
  options?: UseTableOptions<TQuery>,
): UseTableReturn<TItem, TQuery> {
  const defaultPageSize = options?.defaultPageSize ?? 20;
  const [data, setData] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<TQuery>((options?.defaultQuery ?? {}) as TQuery);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...query, page, page_size: pageSize } as TQuery & {
        page: number;
        page_size: number;
      };
      const res = await fetchFn(params);
      setData(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [fetchFn, page, pageSize, query]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTableChange = useCallback(
    (pag: { current?: number; pageSize?: number }) => {
      if (pag.current) setPage(pag.current);
      if (pag.pageSize && pag.pageSize !== pageSize) {
        setPageSize(pag.pageSize);
        setPage(1);
      }
    },
    [pageSize],
  );

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useCallback((keyword: string) => {
    setQuery((prev) => ({ ...prev, keyword } as TQuery));
    setPage(1);
  }, []);

  return {
    data,
    loading,
    pagination: {
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      showTotal: (t: number) => `共 ${t} 条`,
    },
    query,
    setQuery,
    handleTableChange,
    refresh,
    handleSearch,
  };
}
