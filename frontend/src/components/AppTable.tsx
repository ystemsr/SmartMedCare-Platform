import React from 'react';
import { Table, Input, Space, Card } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';

const { Search } = Input;

interface AppTableProps<T> {
  columns: ColumnsType<T>;
  dataSource: T[];
  loading?: boolean;
  pagination?: TablePaginationConfig;
  onChange?: (pagination: TablePaginationConfig) => void;
  onSearch?: (keyword: string) => void;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  rowKey?: string | ((record: T) => string | number);
  rowSelection?: object;
}

/**
 * Reusable table component with built-in search bar and toolbar slot.
 */
function AppTable<T extends object>({
  columns,
  dataSource,
  loading,
  pagination,
  onChange,
  onSearch,
  searchPlaceholder = '请输入关键字搜索',
  toolbar,
  rowKey = 'id',
  rowSelection,
}: AppTableProps<T>) {
  return (
    <Card>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          {onSearch && (
            <Search
              placeholder={searchPlaceholder}
              onSearch={onSearch}
              allowClear
              style={{ width: 280 }}
            />
          )}
        </Space>
        <Space wrap>{toolbar}</Space>
      </div>
      <Table<T>
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={pagination}
        onChange={(pag) => onChange?.(pag)}
        rowKey={rowKey}
        rowSelection={rowSelection}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
}

export default AppTable;
