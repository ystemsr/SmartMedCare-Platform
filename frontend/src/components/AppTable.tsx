import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

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
  if (!dataIndex || typeof dataIndex !== 'string') {
    return undefined;
  }

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
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
}

function resolveTitle(title: AppTableColumn<object>['title']) {
  if (typeof title === 'function') {
    return title({});
  }
  return title ?? '';
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
    if (!rowSelection) {
      return;
    }

    rowSelection.onChange(checked ? rowIds : [], checked ? dataSource : []);
  };

  const handleToggleRow = (record: T, checked: boolean) => {
    if (!rowSelection) {
      return;
    }

    const id = getRowIdentifier(record, rowKey);
    const nextKeys = checked
      ? [...selectedSet, id]
      : [...selectedSet].filter((item) => item !== id);
    const selectedRows = dataSource.filter((item) =>
      nextKeys.includes(getRowIdentifier(item, rowKey)),
    );

    rowSelection.onChange(nextKeys, selectedRows);
  };

  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {onSearch && (
            <TextField
              value={keyword}
              size="small"
              placeholder={searchPlaceholder}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSearch(keyword.trim());
                }
              }}
              sx={{ minWidth: { xs: '100%', sm: 280 } }}
              InputProps={{
                endAdornment: (
                  <Button
                    size="small"
                    startIcon={<SearchRoundedIcon />}
                    onClick={() => onSearch(keyword.trim())}
                  >
                    搜索
                  </Button>
                ),
              }}
            />
          )}
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
          {toolbar}
        </Stack>
      </Stack>

      <Box sx={{ position: 'relative' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.72)',
            }}
          >
            <CircularProgress size={36} />
          </Box>
        )}

        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
          <Table stickyHeader sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                {rowSelection && (
                  <TableCell padding="checkbox" sx={{ width: 56 }}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onChange={(event) => handleSelectAll(event.target.checked)}
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell
                    key={String(column.key ?? column.dataIndex ?? column.title)}
                    align={column.align}
                    sx={{
                      width: column.width,
                      minWidth: column.width,
                      whiteSpace: 'nowrap',
                      position: column.fixed ? 'sticky' : 'static',
                      right: column.fixed === 'right' ? 0 : 'auto',
                      left: column.fixed === 'left' ? 0 : 'auto',
                      zIndex: column.fixed ? 1 : 'auto',
                      backgroundColor: 'background.paper',
                      fontWeight: 700,
                    }}
                  >
                    {resolveTitle(column.title as AppTableColumn<object>['title'])}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {dataSource.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + (rowSelection ? 1 : 0)} align="center">
                    <Typography color="text.secondary" sx={{ py: 4 }}>
                      {emptyText}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                dataSource.map((record, index) => {
                  const id = getRowIdentifier(record, rowKey);

                  return (
                    <TableRow key={id} hover>
                      {rowSelection && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedSet.has(id)}
                            onChange={(event) => handleToggleRow(record, event.target.checked)}
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => {
                        const value = getValue(record, column.dataIndex);
                        const content = column.render
                          ? column.render(value, record, index)
                          : renderFallbackValue(value);

                        return (
                          <TableCell
                            key={String(column.key ?? column.dataIndex ?? column.title)}
                            align={column.align}
                            sx={{
                              width: column.width,
                              minWidth: column.width,
                              maxWidth: column.ellipsis ? column.width : undefined,
                              overflow: column.ellipsis ? 'hidden' : 'visible',
                              textOverflow: column.ellipsis ? 'ellipsis' : 'clip',
                              whiteSpace: column.ellipsis ? 'nowrap' : 'normal',
                              position: column.fixed ? 'sticky' : 'static',
                              right: column.fixed === 'right' ? 0 : 'auto',
                              left: column.fixed === 'left' ? 0 : 'auto',
                              zIndex: column.fixed ? 1 : 'auto',
                              backgroundColor: 'background.paper',
                            }}
                          >
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {pagination && (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={1}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {pagination.showTotal?.(pagination.total) ?? `共 ${pagination.total} 条`}
          </Typography>
          <TablePagination
            component="div"
            count={pagination.total}
            page={Math.max(pagination.current - 1, 0)}
            onPageChange={(_, page) => onChange?.({ current: page + 1, pageSize: pagination.pageSize })}
            rowsPerPage={pagination.pageSize}
            onRowsPerPageChange={(event) =>
              onChange?.({
                current: 1,
                pageSize: Number(event.target.value),
              })
            }
            labelRowsPerPage="每页条数"
            rowsPerPageOptions={
              pagination.showSizeChanger ? [10, 20, 50, 100].map((value) => ({
                label: `${value}`,
                value,
              })) : []
            }
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
            slotProps={{
              select: {
                size: 'small',
              },
            }}
            showFirstButton
            showLastButton
          />
        </Stack>
      )}
    </Card>
  );
}

export default AppTable;
