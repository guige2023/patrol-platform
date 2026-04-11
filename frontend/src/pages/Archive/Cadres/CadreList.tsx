import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getCadres, deleteCadre } from '@/api/cadres';
import type { ColumnsType } from 'antd/es/table';

interface Cadre {
  id: string;
  name: string;
  gender?: string;
  position?: string;
  rank?: string;
  unit_id?: string;
  tags?: string[];
  is_available: boolean;
}

const CadreList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Cadre[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCadres({ page, page_size: pageSize, ...searchParams });
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
      await deleteCadre(id);
      message.success('删除成功');
      fetchData();
    }});
  };

  const columns: ColumnsType<Cadre> = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '性别', dataIndex: 'gender', key: 'gender' },
    { title: '职务', dataIndex: 'position', key: 'position' },
    { title: '职级', dataIndex: 'rank', key: 'rank' },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags?.map(t => <Tag key={t}>{t}</Tag>) || [],
    },
    {
      title: '可用',
      dataIndex: 'is_available',
      key: 'is_available',
      render: (v: boolean) => <span style={{ color: v ? '#52c41a' : '#ff4d4f' }}>{v ? '是' : '否'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small">查看</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="干部人才库" breadcrumbs={[{ name: '档案管理' }, { name: '干部人才库' }]} />
      <SearchForm
        fields={[{ name: 'name', label: '姓名', placeholder: '请输入姓名' }]}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('新建干部')}>
          新建干部
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

export default CadreList;
