import { Table, Pagination, Space } from 'antd';
import type { TableProps } from 'antd';

interface DataTableProps<T> extends Omit<TableProps<T>, 'dataSource'> {
  dataSource?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  loading?: boolean;
}

function DataTable<T extends { id?: string }>({
  dataSource = [],
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  loading,
  ...tableProps
}: DataTableProps<T>) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Table<T>
        dataSource={dataSource}
        rowKey="id"
        loading={loading}
        pagination={false}
        {...tableProps}
      />
      {total > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={onPageChange}
            showSizeChanger
            showTotal={(total) => `共 ${total} 条`}
          />
        </div>
      )}
    </Space>
  );
}

export default DataTable;