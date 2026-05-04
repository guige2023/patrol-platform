import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message, Popconfirm, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Key } from 'antd/es/table/interface';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getDrafts, submitDraft, deleteDraft, exportDrafts, batchDeleteDrafts } from '@/api/drafts';
import DraftDetail from './DraftDetail';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';
import { useAuthStore, hasPermission } from '@/store/auth';

const { TextArea } = Input;

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
  const { user } = useAuthStore();
  const canApprove = hasPermission(user, 'draft:approve');
  const canWrite = hasPermission(user, 'draft:write');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Draft[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  // 审批评论弹窗
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveAction, setApproveAction] = useState<string>('');
  const [approveDraftId, setApproveDraftId] = useState<string>('');
  const [approveComment, setApproveComment] = useState<string>('');
  const [approveLoading, setApproveLoading] = useState(false);

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

  // 审批操作（初审通过/终审通过/审批通过/驳回）
  const openApproveModal = (draftId: string, action: string) => {
    setApproveDraftId(draftId);
    setApproveAction(action);
    setApproveComment('');
    setApproveModalOpen(true);
  };

  const handleApprove = async () => {
    if (!approveDraftId) return;
    setApproveLoading(true);
    try {
      await submitDraft(approveDraftId, approveAction, approveComment);
      message.success('审批成功');
      setApproveModalOpen(false);
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '审批失败');
    } finally {
      setApproveLoading(false);
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
          {record.status === 'draft' && canWrite && (
            <Button type="link" size="small" onClick={() => handleSubmit(record.id)}>提交</Button>
          )}
          {/* 审批操作按钮（有 draft:approve 权限可见） */}
          {canApprove && record.status === 'preliminary_review' && (
            <Button type="link" size="small" onClick={() => openApproveModal(record.id, 'preliminary_review')}>初审通过</Button>
          )}
          {canApprove && record.status === 'final_review' && (
            <Button type="link" size="small" onClick={() => openApproveModal(record.id, 'final_review')}>终审通过</Button>
          )}
          {canApprove && (record.status === 'preliminary_review' || record.status === 'final_review') && (
            <>
              <Button type="link" size="small" onClick={() => openApproveModal(record.id, 'approve')}>审批通过</Button>
              <Button type="link" size="small" danger onClick={() => openApproveModal(record.id, 'reject')}>驳回</Button>
            </>
          )}
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

      {/* 审批评论弹窗 */}
      <Modal
        title={{
          preliminary_review: '初审通过',
          final_review: '终审通过',
          approve: '审批通过',
          reject: '驳回底稿',
        }[approveAction] || '审批'}
        open={approveModalOpen}
        onOk={handleApprove}
        onCancel={() => setApproveModalOpen(false)}
        confirmLoading={approveLoading}
        okText="确认"
        cancelText="取消"
        okButtonProps={approveAction === 'reject' ? { danger: true } : undefined}
      >
        <div style={{ padding: '8px 0' }}>
          <TextArea
            rows={3}
            placeholder="可填写审批意见（可选）"
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default DraftList;
