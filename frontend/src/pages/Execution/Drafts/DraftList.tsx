import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getDrafts, submitDraft } from '@/api/drafts';
import type { ColumnsType } from 'antd/es/table';

interface Draft {
  id: string;
  title: string;
  unit_id: string;
  status: string;
  category?: string;
  problem_type?: string;
  severity?: string;
}

const statusColors: Record<string, string> = {
  draft: 'default',
  preliminary_review: 'processing',
  final_review: 'warning',
  approved: 'success',
  rejected: 'error',
};

const DraftList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Draft[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDrafts({ page, page_size: pageSize, ...searchParams });
      setData(res.data.items);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  const handleSubmit = async (id: string) => {
    try {
      await submitDraft(id, 'submit');
      message.success('提交成功');
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '提交失败');
    }
  };

  const columns: ColumnsType<Draft> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '类别', dataIndex: 'category', key: 'category' },
    { title: '问题类型', dataIndex: 'problem_type', key: 'problem_type' },
    { title: '严重程度', dataIndex: 'severity', key: 'severity' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small">查看</Button>
          <Button type="link" size="small">编辑</Button>
          {record.status === 'draft' && <Button type="link" size="small" onClick={() => handleSubmit(record.id)}>提交</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="底稿管理" breadcrumbs={[{ name: '执纪执行' }, { name: '底稿管理' }]} />
      <SearchForm
        fields={[{ name: 'title', label: '标题', placeholder: '请输入标题' }]}
        onSearch={setSearchParams}
        onReset={() => setSearchParams({})}
      />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('新建底稿')}>新建底稿</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  );
};

export default DraftList;
