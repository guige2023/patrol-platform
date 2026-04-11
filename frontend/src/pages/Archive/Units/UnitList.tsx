import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getUnits, deleteUnit } from '@/api/units';
import type { ColumnsType } from 'antd/es/table';

interface Unit {
  id: string;
  name: string;
  org_code: string;
  unit_type?: string;
  level?: number;
  is_active: boolean;
}

const UnitList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUnits({ page, page_size: pageSize, ...searchParams });
      setData(res.data.items);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  const handleSearch = (values: any) => setSearchParams(values);
  const handleReset = () => setSearchParams({});

  const handleDelete = async (id: string) => {
    Modal.confirm({ title: '确认删除？', onOk: async () => {
      await deleteUnit(id);
      message.success('删除成功');
      fetchData();
    }});
  };

  const columns: ColumnsType<Unit> = [
    { title: '单位名称', dataIndex: 'name', key: 'name' },
    { title: '组织编码', dataIndex: 'org_code', key: 'org_code' },
    { title: '类型', dataIndex: 'unit_type', key: 'unit_type' },
    { title: '级别', dataIndex: 'level', key: 'level' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small">编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="单位档案" breadcrumbs={[{ name: '档案管理' }, { name: '单位档案' }]} />
      <SearchForm
        fields={[{ name: 'name', label: '单位名称', placeholder: '请输入单位名称' }]}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('新建单位')}>
          新建单位
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </div>
  );
};

export default UnitList;
