import React, { useMemo, useState } from 'react';
import { Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { Button, Card, Checkbox, Input, Select, Spinner } from './ui';

export interface AppTableColumn<T> {
  title?: React.ReactNode | ((props: any) => React.ReactNode);
  dataIndex?: keyof T | string;
  key?: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  fixed?: 'left' | 'right';
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

export type ColumnsType<T> = AppTableColumn<T>[];

export interface AppTablePagination {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showTotal?: (total: number) => string;
}

interface AppTableRowSelection<T> {
  selectedRowKeys: React.Key[];
  onChange: (selectedRowKeys: React.Key[], selectedRows?: T[]) => void;
}

interface AppTableProps<T> {
  columns: AppTableColumn<T>[];
  dataSource: T[];
  loading?: boolean;
  pagination?: AppTablePagination | false;
  onChange?: (pagination: { current?: number; pageSize?: number }) => void;
  onSearch?: (keyword: string) => void;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  rowKey?: string | ((record: T) => string | number);
  rowSelection?: AppTableRowSelection<T>;
  emptyText?: string;
}

function getValue(record: unknown, dataIndex?: string | number | symbol) {
  if (!dataIndex || typeof dataIndex !== 'string') return undefined;
  return dataIndex.split('.').reduce<unknown>((result, key) => {
    if (result && typeof result === 'object' && key in result) {
      return (result as Record<string, unknown>)[key];
    }
    return undefined;
  }, record);
}

function getRowIdentifier<T>(record: T, rowKey: string | ((record: T) => string | number)) {
  return typeof rowKey === 'function'
    ? rowKey(record)
    : (record as Record<string, string | number | undefined>)[rowKey] ?? '';
}

function renderFallbackValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function resolveTitle(title: AppTableColumn<object>['title']) {
  if (typeof title === 'function') return title({});
  return title ?? '';
}

function Pagination({
  current,
  pageSize,
  total,
  onChange,
  showSizeChanger,
}: {
  current: number;
  pageSize: number;
  total: number;
  onChange: (p: { current?: number; pageSize?: number }) => void;
  showSizeChanger?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const go = (page: number) => {
    if (page < 1 || page > totalPages || page === current) return;
    onChange({ current: page, pageSize });
  };
  const pages: (number | '...')[] = useMemo(() => {
    const list: (number | '...')[] = [];
    const push = (n: number | '...') => list.push(n);
    const range = (from: number, to: number) => {
      for (let i = from; i <= to; i += 1) push(i);
    };
    if (totalPages <= 7) {
      range(1, totalPages);
    } else {
      push(1);
      if (current > 4) push('...');
      const s = Math.max(2, current - 2);
      const e = Math.min(totalPages - 1, current + 2);
      range(s, e);
      if (current < totalPages - 3) push('...');
      push(totalPages);
    }
    return list;
  }, [current, totalPages]);

  return (
    <div className="smc-pag">
      <button className="smc-pag__btn" onClick={() => go(1)} disabled={current === 1} aria-label="第一页">
        <ChevronsLeft size={14} />
      </button>
      <button
        className="smc-pag__btn"
        onClick={() => go(current - 1)}
        disabled={current === 1}
        aria-label="上一页"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} style={{ padding: '0 4px', color: 'var(--smc-text-3)' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            className={`smc-pag__btn ${p === current ? 'smc-pag__btn--active' : ''}`}
            onClick={() => go(p)}
          >
            {p}
          </button>
        ),
      )}
      <button
        className="smc-pag__btn"
        onClick={() => go(current + 1)}
        disabled={current >= totalPages}
        aria-label="下一页"
      >
        <ChevronRight size={14} />
      </button>
      <button
        className="smc-pag__btn"
        onClick={() => go(totalPages)}
        disabled={current >= totalPages}
        aria-label="最后一页"
      >
        <ChevronsRight size={14} />
      </button>
      {showSizeChanger && (
        <div style={{ marginLeft: 8, width: 100 }}>
          <Select
            value={pageSize}
            onChange={(v) => onChange({ current: 1, pageSize: Number(v) })}
            options={[10, 20, 50, 100].map((v) => ({ label: `${v} / 页`, value: v }))}
          />
        </div>
      )}
    </div>
  );
}

function AppTable<T extends object>({
  columns,
  dataSource,
  loading = false,
  pagination,
  onChange,
  onSearch,
  searchPlaceholder = '请输入关键字搜索',
  toolbar,
  rowKey = 'id',
  rowSelection,
  emptyText = '暂无数据',
}: AppTableProps<T>) {
  const [keyword, setKeyword] = useState('');

  const rowIds = useMemo(
    () => dataSource.map((record) => getRowIdentifier(record, rowKey)),
    [dataSource, rowKey],
  );

  const selectedSet = useMemo(
    () => new Set(rowSelection?.selectedRowKeys ?? []),
    [rowSelection?.selectedRowKeys],
  );

  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedSet.has(id));
  const partiallySelected = rowIds.some((id) => selectedSet.has(id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (!rowSelection) return;
    rowSelection.onChange(checked ? rowIds : [], checked ? dataSource : []);
  };

  const handleToggleRow = (record: T, checked: boolean) => {
    if (!rowSelection) return;
    const id = getRowIdentifier(record, rowKey);
    const nextKeys = checked
      ? [...selectedSet, id]
      : [...selectedSet].filter((item) => item !== id);
    const selectedRows = dataSource.filter((item) =>
      nextKeys.includes(getRowIdentifier(item, rowKey)),
    );
    rowSelection.onChange(nextKeys as React.Key[], selectedRows);
  };

  return (
    <Card>
      <div style={{ padding: 20 }}>
        <div className="smc-table__toolbar">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {onSearch && (
              <div className="smc-table__search">
                <Input
                  value={keyword}
                  placeholder={searchPlaceholder}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSearch(keyword.trim());
                  }}
                  containerClassName=""
                  fullWidth={false}
                  style={{ width: 240 }}
                />
                <Button
                  variant="primary"
                  startIcon={<Search size={14} />}
                  onClick={() => onSearch(keyword.trim())}
                >
                  搜索
                </Button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{toolbar}</div>
        </div>

        <div className="smc-table-wrap">
          {loading && (
            <div className="smc-table__overlay">
              <Spinner />
            </div>
          )}
          <div className="smc-table-scroll">
            <table className="smc-table">
              <thead>
                <tr>
                  {rowSelection && (
                    <th style={{ width: 44 }}>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={partiallySelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                  )}
                  {columns.map((column) => (
                    <th
                      key={String(column.key ?? column.dataIndex ?? column.title)}
                      style={{
                        textAlign: column.align || 'left',
                        width: column.width,
                        minWidth: column.width,
                        position: column.fixed ? 'sticky' : undefined,
                        right: column.fixed === 'right' ? 0 : undefined,
                        left: column.fixed === 'left' ? 0 : undefined,
                      }}
                    >
                      {resolveTitle(column.title as AppTableColumn<object>['title'])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataSource.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (rowSelection ? 1 : 0)}
                      className="smc-table__empty"
                    >
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  dataSource.map((record, index) => {
                    const id = getRowIdentifier(record, rowKey);
                    return (
                      <tr key={String(id)}>
                        {rowSelection && (
                          <td>
                            <Checkbox
                              checked={selectedSet.has(id)}
                              onChange={(e) => handleToggleRow(record, e.target.checked)}
                            />
                          </td>
                        )}
                        {columns.map((column) => {
                          const value = getValue(record, column.dataIndex);
                          const content = column.render
                            ? column.render(value, record, index)
                            : renderFallbackValue(value);
                          return (
                            <td
                              key={String(column.key ?? column.dataIndex ?? column.title)}
                              style={{
                                textAlign: column.align || 'left',
                                width: column.width,
                                minWidth: column.width,
                                maxWidth: column.ellipsis ? column.width : undefined,
                                overflow: column.ellipsis ? 'hidden' : undefined,
                                textOverflow: column.ellipsis ? 'ellipsis' : undefined,
                                whiteSpace: column.ellipsis ? 'nowrap' : undefined,
                                position: column.fixed ? 'sticky' : undefined,
                                right: column.fixed === 'right' ? 0 : undefined,
                                left: column.fixed === 'left' ? 0 : undefined,
                                background: column.fixed ? 'var(--smc-surface)' : undefined,
                              }}
                            >
                              {content}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {pagination && (
          <div className="smc-table__pag">
            <div style={{ color: 'var(--smc-text-3)', fontSize: 13 }}>
              {pagination.showTotal?.(pagination.total) ?? `共 ${pagination.total} 条`}
            </div>
            <Pagination
              current={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              showSizeChanger={pagination.showSizeChanger}
              onChange={(next) => onChange?.(next)}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default AppTable;
