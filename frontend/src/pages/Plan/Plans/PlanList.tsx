import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message, Popconfirm, Input, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getPlans, submitPlan, approvePlan, publishPlan, deletePlan, exportPlans, updatePlanStatus } from '@/api/plans';
import PlanDetail from './PlanDetail';
import CreatePlanModal from './CreatePlanModal';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';

interface Plan {
  id: string;
  name: string;
  round_name?: string;
  year: number;
  status: string;
  planned_start_date?: string;
  planned_end_date?: string;
}

const statusColors: Record<string, string> = {
  draft: 'default',
  submitted: 'processing',
  approved: 'success',
  published: 'purple',
  in_progress: 'blue',
  completed: 'green',
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  submitted: '已提交',
  approved: '已批准',
  published: '已发布',
  in_progress: '进行中',
  completed: '已完成',
};

const PlanList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'create' | 'view' | 'edit'>('create');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [yearFilter, setYearFilter] = useState<number | undefined>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getPlans({ page, page_size: pageSize, name: keyword || undefined, status: statusFilter, year: yearFilter });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, keyword, statusFilter, yearFilter]);

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (val: string | undefined) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    setYearFilter(isNaN(v) ? undefined : v);
    setPage(1);
  };

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'submit') await submitPlan(id);
      else if (action === 'approve') await approvePlan(id);
      else if (action === 'publish') await publishPlan(id);
      else if (action === 'in_progress' || action === 'completed') await updatePlanStatus(id, action);
      message.success(`${action} 成功`);
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '操作失败');
    }
  };

  const openCreateModal = () => {
    setCreateModalOpen(true);
  };

  const openViewModal = (id: string) => {
    setEditingId(id);
    setDetailMode('view');
    setDetailModalOpen(true);
  };

  const openEditModal = (id: string) => {
    setEditingId(id);
    setDetailMode('edit');
    setDetailModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePlan(id);
      message.success('删除成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const columns: ColumnsType<Plan> = [
    { title: '计划名称', dataIndex: 'name', key: 'name' },
    { title: '轮次', dataIndex: 'round_name', key: 'round_name' },
    { title: '年份', dataIndex: 'year', key: 'year' },
    { title: '计划开始', dataIndex: 'planned_start_date', key: 'planned_start_date', render: (t: string) => t?.split('T')[0] },
    { title: '计划结束', dataIndex: 'planned_end_date', key: 'planned_end_date', render: (t: string) => t?.split('T')[0] },
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
          <Button type="link" size="small" onClick={() => openViewModal(record.id)}>查看</Button>
          <Button type="link" size="small" onClick={() => openEditModal(record.id)}>编辑</Button>
          {record.status === 'draft' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'submit')}>提交</Button>}
          {record.status === 'submitted' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'approve')}>批准</Button>}
          {record.status === 'approved' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'publish')}>发布</Button>}
          {record.status === 'published' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'in_progress')}>开始执行</Button>}
          {record.status === 'in_progress' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'completed')}>完成</Button>}
          <Popconfirm title="确认删除该计划？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="巡察计划" breadcrumbs={[{ name: '巡察计划' }, { name: '计划管理' }]} />
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ marginRight: 8 }}>新建计划</Button>
        <Button onClick={() => exportPlans().catch(e => message.error('导出失败'))}>导出</Button>
        <Input placeholder="搜索计划名称" style={{ width: 160 }} onChange={handleKeywordChange} />
        <Select
          placeholder="按状态筛选"
          allowClear
          style={{ width: 120 }}
          options={[
            { label: '草稿', value: 'draft' },
            { label: '已提交', value: 'submitted' },
            { label: '已批准', value: 'approved' },
            { label: '已发布', value: 'published' },
            { label: '进行中', value: 'in_progress' },
            { label: '已完成', value: 'completed' },
          ]}
          onChange={handleStatusChange}
        />
        <Input
          placeholder="年份"
          type="number"
          style={{ width: 100 }}
          onChange={handleYearChange}
        />
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `共 ${t} 条` }} />
      <PlanDetail
        open={detailModalOpen}
        planId={editingId}
        mode={detailMode}
        onClose={() => setDetailModalOpen(false)}
        onSuccess={() => { setDetailModalOpen(false); fetchData(); }}
      />
      <CreatePlanModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => { setCreateModalOpen(false); fetchData(); }}
      />
    </div>
  );
};

export default PlanList;
