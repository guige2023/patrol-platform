import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons';
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
      setData(res.items ?? []);
      setTotal(res.total ?? 0);
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

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18800';

  // 批量下载附件
  const handleDownloadAttachments = async (record: Knowledge) => {
    const attachments = (record as any).attachments || [];
    if (attachments.length === 0) {
      message.warning('暂无附件');
      return;
    }
    if (attachments.length === 1) {
      // 单文件直接下载
      await downloadFile(record.id, attachments[0].filename);
    } else {
      // 多文件逐个下载
      for (const att of attachments) {
        await downloadFile(record.id, att.filename);
      }
    }
  };

  const downloadFile = async (knowledgeId: string, filename: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/knowledge-files/${knowledgeId}/attachments/${encodeURIComponent(filename)}/download`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('下载失败');
      const blob = await response.blob();
      const contentDisp = response.headers.get('Content-Disposition') || '';
      const fnMatch = contentDisp.match(/filename\*?=['"]?(?:UTF-8'')?([^;\n"']+)/i);
      const downloadName = fnMatch ? decodeURIComponent(fnMatch[1]) : filename;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(`下载 ${filename} 失败`);
    }
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
    {
      title: '附件',
      key: 'attachments',
      render: (_: any, record: Knowledge) => {
        const attachments: any[] = (record as any).attachments || [];
        if (attachments.length === 0) return <span style={{ color: '#bfbfbf' }}>-</span>;
        return (
          <Space size={4}>
            <PaperClipOutlined style={{ color: '#1677ff' }} />
            <span>{attachments.length}</span>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownloadAttachments(record)}
              style={{ padding: 0, height: 'auto' }}
            >
              下载
            </Button>
          </Space>
        );
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t?.split('T')[0] },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setModalKnowledgeId(record.id); setModalOpen(true); }}>查看</Button>
          <Button type="link" size="small" onClick={() => { setModalKnowledgeId(record.id); setModalOpen(true); }}>编辑</Button>
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
        <Button onClick={() => exportKnowledge().catch(() => message.error('导出失败'))}>导出</Button>
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
