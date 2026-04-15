import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Select, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getGroups, deleteGroup, exportGroups } from '@/api/groups';
import GroupDetail from './GroupDetail';
import GroupMemberModal from './GroupMemberModal';
import CreateGroupModal from './CreateGroupModal';
import { getPlans } from '@/api/plans';
import { getErrorMessage } from '@/utils/error';
import type { ColumnsType } from 'antd/es/table';

interface Group {
  id: string;
  name: string;
  plan_id: string;
  status: string;
  member_count: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'default',
  approved: 'success',
  active: 'processing',
  completed: 'green',
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  approved: '已审批',
  active: '进行中',
  completed: '已完成',
};

const GroupList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Group[]>([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'create' | 'view' | 'edit'>('create');
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberGroupId, setMemberGroupId] = useState<string>('');
  const [memberGroupName, setMemberGroupName] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  // 筛选
  const [filterPlanId, setFilterPlanId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [planOptions, setPlanOptions] = useState<{label: string; value: string}[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getGroups({ plan_id: filterPlanId, status: filterStatus });
      const items = Array.isArray(res) ? res : (res.items || []);
      setData(items);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanOptions = async () => {
    try {
      const res = await getPlans({ page_size: 100 });
      setPlanOptions((res.items || []).map((p: any) => ({ label: p.name, value: p.id })));
    } catch {}
  };

  useEffect(() => { fetchData(); }, [filterPlanId, filterStatus]);
  useEffect(() => { fetchData(); loadPlanOptions(); }, []);

  const openCreateModal = () => {
    setCreateModalOpen(true);
  };

  const openViewModal = (record: Group) => {
    setEditingId(record.id);
    setDetailMode('view');
    setDetailModalOpen(true);
  };

  const openEditModal = (record: Group) => {
    setEditingId(record.id);
    setDetailMode('edit');
    setDetailModalOpen(true);
  };

  const handleDetailSuccess = () => {
    setDetailModalOpen(false);
    setEditingId(null);
    fetchData();
  };

  const handleDetailCancel = () => {
    setDetailModalOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGroup(id);
      message.success('删除成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const columns: ColumnsType<Group> = [
    { title: '巡察组名称', dataIndex: 'name', key: 'name' },
    { title: '成员数量', dataIndex: 'member_count', key: 'member_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{statusLabels[s] || s}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t?.split('T')[0] },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openViewModal(record)}>查看</Button>
          <Button type="link" size="small" onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" size="small" onClick={() => { setMemberGroupId(record.id); setMemberGroupName(record.name); setMemberModalOpen(true); }}>添加成员</Button>
          <Popconfirm title="确认删除该巡察组？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="巡察组" breadcrumbs={[{ name: '巡察计划' }, { name: '巡察组' }]} />
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ marginRight: 8 }}>新建巡察组</Button>
        <Button onClick={() => exportGroups({ plan_id: filterPlanId, status: filterStatus }).catch((e: any) => message.error('导出失败'))} style={{ marginRight: 8 }}>导出</Button>
        <Select
          placeholder="按计划筛选"
          allowClear
          style={{ width: 200 }}
          options={planOptions}
          onChange={setFilterPlanId}
          showSearch
          filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
        <Select
          placeholder="按状态筛选"
          allowClear
          style={{ width: 120 }}
          options={[
            { label: '草稿', value: 'draft' },
            { label: '已审批', value: 'approved' },
            { label: '进行中', value: 'active' },
            { label: '已完成', value: 'completed' },
          ]}
          onChange={setFilterStatus}
        />
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
      <GroupDetail
        open={detailModalOpen}
        editingId={editingId}
        mode={detailMode}
        onCancel={handleDetailCancel}
        onSuccess={handleDetailSuccess}
      />
      <GroupMemberModal
        open={memberModalOpen}
        groupId={memberGroupId}
        groupName={memberGroupName}
        onClose={() => { setMemberModalOpen(false); setMemberGroupId(''); setMemberGroupName(''); }}
        onSuccess={fetchData}
      />
      <CreateGroupModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => { setCreateModalOpen(false); fetchData(); }}
      />
    </div>
  );
};

export default GroupList;
