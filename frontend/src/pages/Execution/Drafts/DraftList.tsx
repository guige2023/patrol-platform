import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Key } from 'antd/es/table/interface';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getDrafts, submitDraft, deleteDraft, exportDrafts, batchDeleteDrafts } from '@/api/drafts';
import DraftDetail from './DraftDetail';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';

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

const statusLabels: Record<string, string> = {
  draft: '草稿',
  preliminary_review: '初审',
  final_review: '终审',
  approved: '已批准',
  rejected: '已驳回',
};

const DraftList: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Draft[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDrafts({ page, page_size: pageSize, ...searchParams });
      setData(res.items ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  // Auto-open draft detail when navigated via /execution/drafts/:id (e.g., from global search)
  useEffect(() => {
    if (id) {
      setEditingId(id);
      setDetailModalOpen(true);
    }
  }, [id]);

  const handleSearch = (values: any) => setSearchParams(values);
  const handleReset = () => setSearchParams({});

  const handleSubmit = async (id: string) => {
    try {
      await submitDraft(id, 'submit');
      message.success('提交成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '提交失败');
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      onOk: async () => {
        await deleteDraft(id);
        message.success('删除成功');
        fetchData();
      },
    });
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await batchDeleteDrafts(selectedRowKeys as string[]);
      message.success('批量删除成功');
      setSelectedRowKeys([]);
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '批量删除失败');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setDetailModalOpen(true);
  };

  const openEditModal = (id: string) => {
    setEditingId(id);
    setDetailModalOpen(true);
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
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{statusLabels[s] || s}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEditModal(record.id)}>查看</Button>
          <Button type="link" size="small" onClick={() => openEditModal(record.id)}>编辑</Button>
          {record.status === 'draft' && <Button type="link" size="small" onClick={() => handleSubmit(record.id)}>提交</Button>}
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="底稿管理" breadcrumbs={[{ name: '执纪执行' }, { name: '底稿管理' }]} />
      <SearchForm
        fields={[{ name: 'title', label: '标题', placeholder: '请输入标题' }]}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ marginRight: 8 }}>新建底稿</Button>
        <Button onClick={() => exportDrafts().catch(() => message.error('导出失败'))} style={{ marginRight: 8 }}>导出</Button>
        {selectedRowKeys.length > 0 && (
          <Popconfirm title={`确认删除选中的 ${selectedRowKeys.length} 条底稿？`} onConfirm={handleBatchDelete}>
            <Button danger>批量删除（{selectedRowKeys.length}）</Button>
          </Popconfirm>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
        pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `共 ${t} 条` }}
      />
      <DraftDetail
        open={detailModalOpen}
        editingId={editingId}
        onClose={() => {
          setDetailModalOpen(false);
          setEditingId(null);
          if (id) navigate('/execution/drafts', { replace: true });
        }}
        onSuccess={() => {
          setDetailModalOpen(false);
          setEditingId(null);
          fetchData();
          if (id) navigate('/execution/drafts', { replace: true });
        }}
      />
    </div>
  );
};

export default DraftList;
