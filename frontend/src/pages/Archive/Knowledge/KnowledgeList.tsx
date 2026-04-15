import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import KnowledgeModal from './KnowledgeModal';
import { getKnowledgeList, deleteKnowledge, publishKnowledge, exportKnowledge } from '@/api/knowledge';
import type { ColumnsType } from 'antd/es/table';

interface Knowledge {
  id: string;
  title: string;
  category: string;
  version: string;
  tags?: string[];
  is_published: boolean;
  created_at: string;
}

const KnowledgeList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Knowledge[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [modalKnowledgeId, setModalKnowledgeId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getKnowledgeList({ page, page_size: pageSize, ...searchParams });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  const handleSearch = (values: any) => setSearchParams(values);
  const handleReset = () => setSearchParams({});

  const handlePublish = async (id: string) => {
    await publishKnowledge(id);
    message.success('发布成功');
    fetchData();
  };

  const categoryColors: Record<string, string> = {
    regulation: 'blue',
    policy: 'green',
    dict: 'orange',
    guide: 'purple',
    education: 'cyan',
    cadre: 'gold',
    accountability: 'red',
    inspection: 'geekblue',
    law: 'volcano',
    discipline: 'magenta',
    other: 'default',
  };

const categoryLabels: Record<string, string> = {
    regulation: '法规',
    policy: '政策',
    dict: '字典',
    guide: '指南',
    education: '教育',
    cadre: '干部',
    accountability: '问责',
    inspection: '巡察',
    law: '法律',
    discipline: '纪律',
    other: '其他',
  };

  const columns: ColumnsType<Knowledge> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (c: string) => <Tag color={categoryColors[c] || 'default'}>{categoryLabels[c] || c}</Tag>,
    },
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags?.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>) || [],
    },
    {
      title: '状态',
      dataIndex: 'is_published',
      key: 'is_published',
      render: (v: boolean) => <span style={{ color: v ? '#52c41a' : '#faad14' }}>{v ? '已发布' : '草稿'}</span>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t?.split('T')[0] },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setModalKnowledgeId(record.id); setModalOpen(true); }}>查看</Button>
          {!record.is_published && (
            <Button type="link" size="small" onClick={() => handlePublish(record.id)}>发布</Button>
          )}
          <Button type="link" size="small" danger onClick={() => Modal.confirm({ title: '确认删除？', onOk: async () => { await deleteKnowledge(record.id); message.success('删除成功'); fetchData(); } })}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="知识库" breadcrumbs={[{ name: '档案管理' }, { name: '知识库' }]} />
      <SearchForm
        fields={[
          { name: 'title', label: '标题', placeholder: '请输入标题' },
          { name: 'category', label: '分类', placeholder: '请输入分类' },
        ]}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModalKnowledgeId(null); setModalOpen(true); }} style={{ marginRight: 8 }}>新建知识</Button>
        <Button onClick={() => exportKnowledge().catch(e => message.error('导出失败'))}>导出</Button>
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
      <KnowledgeModal
        open={modalOpen}
        knowledgeId={modalKnowledgeId}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default KnowledgeList;
