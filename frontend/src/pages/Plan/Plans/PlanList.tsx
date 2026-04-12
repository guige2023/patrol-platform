import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getPlans, submitPlan, approvePlan, publishPlan } from '@/api/plans';
import PlanDetail from './PlanDetail';
import type { ColumnsType } from 'antd/es/table';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'create' | 'view' | 'edit'>('create');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getPlans({ page, page_size: pageSize });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleAction = async (id: string, action: string) => {
    try {
      if (action === 'submit') await submitPlan(id);
      else if (action === 'approve') await approvePlan(id);
      else if (action === 'publish') await publishPlan(id);
      message.success(`${action} 成功`);
      fetchData();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setDetailMode('create');
    setDetailModalOpen(true);
  };

  const openViewModal = (id: string) => {
    setEditingId(id);
    setDetailMode('view');
    setDetailModalOpen(true);
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
          {record.status === 'draft' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'submit')}>提交</Button>}
          {record.status === 'submitted' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'approve')}>批准</Button>}
          {record.status === 'approved' && <Button type="link" size="small" onClick={() => handleAction(record.id, 'publish')}>发布</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="巡察计划" breadcrumbs={[{ name: '巡察计划' }, { name: '计划管理' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建计划</Button>
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
    </div>
  );
};

export default PlanList;
