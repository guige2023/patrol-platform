import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Tag, Select, message, Popconfirm, Card, Statistic, Row, Col, Input } from 'antd';
import { PlusOutlined, UsergroupAddOutlined, CheckCircleOutlined, PlayCircleOutlined, FileDoneOutlined, EditOutlined, SearchOutlined } from '@ant-design/icons';
import type { Key } from 'antd/es/table/interface';
import PageHeader from '@/components/common/PageHeader';
import { getGroups, deleteGroup, exportGroups, batchDeleteGroups } from '@/api/groups';
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
  const [searchText, setSearchText] = useState<string>('');
  const [planOptions, setPlanOptions] = useState<{label: string; value: string}[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getGroups({ plan_id: filterPlanId, status: filterStatus, search: searchText });
      const items = Array.isArray(res) ? res : (res?.items ?? []);
      setData(items);
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = useMemo(() => ({
    draft: data.filter(g => g.status === 'draft').length,
    approved: data.filter(g => g.status === 'approved').length,
    active: data.filter(g => g.status === 'active').length,
    completed: data.filter(g => g.status === 'completed').length,
    total: data.length,
  }), [data]);

  const statCards = [
    { key: 'draft', label: '草稿', value: statusCounts.draft, color: '#8c8c8c', icon: <EditOutlined /> },
    { key: 'approved', label: '已审批', value: statusCounts.approved, color: '#52c41a', icon: <CheckCircleOutlined /> },
    { key: 'active', label: '进行中', value: statusCounts.active, color: '#1677ff', icon: <PlayCircleOutlined /> },
    { key: 'completed', label: '已完成', value: statusCounts.completed, color: '#722ed1', icon: <FileDoneOutlined /> },
  ];

  const loadPlanOptions = async () => {
    try {
      const res = await getPlans({ page_size: 100 });
      setPlanOptions((res.items || []).map((p: any) => ({ label: p.name, value: p.id })));
    } catch {}
  };

  useEffect(() => { fetchData(); }, [filterPlanId, filterStatus, searchText]);
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

  const handleBatchExport = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await exportGroups({ ids: selectedRowKeys.join(',') });
      message.success('批量导出成功');
    } catch {
      message.error('批量导出失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await batchDeleteGroups(selectedRowKeys as string[]);
      message.success('批量删除成功');
      setSelectedRowKeys([]);
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '批量删除失败');
    }
  };

  const columns: ColumnsType<Group> = [
    { title: '巡察组名称', dataIndex: 'name', key: 'name', render: (n: string) => n || '-' },
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

      {/* 状态统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {statCards.map(card => (
          <Col key={card.key} xs={12} sm={6}>
            <Card size="small" variant="borderless" style={{ textAlign: 'center', background: '#fafafa' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <div style={{ color: card.color, fontSize: 18 }}>{card.icon}</div>
                <Statistic
                  title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>{card.label}</span>}
                  value={card.value}
                  valueStyle={{ color: card.color, fontSize: 22, fontWeight: 600 }}
                />
              </Space>
            </Card>
          </Col>
        ))}
        <Col xs={12} sm={6}>
          <Card size="small" variant="borderless" style={{ textAlign: 'center', background: '#fafafa' }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div style={{ color: '#595959', fontSize: 18 }}><UsergroupAddOutlined /></div>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#8c8c8c' }}>全部巡察组</span>}
                value={statusCounts.total}
                valueStyle={{ color: '#595959', fontSize: 22, fontWeight: 600 }}
              />
            </Space>
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Input.Search
          placeholder="搜索巡察组名称"
          onSearch={(value) => { setSearchText(value); }}
          style={{ width: 200 }}
          allowClear
          enterButton={<Button icon={<SearchOutlined />}>搜索</Button>}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ marginRight: 8 }}>新建巡察组</Button>
        <Button onClick={() => exportGroups({ plan_id: filterPlanId, status: filterStatus }).catch(() => message.error('导出失败'))} style={{ marginRight: 8 }}>导出全部</Button>
        {selectedRowKeys.length > 0 ? (
          <>
            <Button onClick={handleBatchExport}>批量导出（{selectedRowKeys.length}）</Button>
            <Popconfirm title={`确认删除选中的 ${selectedRowKeys.length} 个巡察组？`} onConfirm={handleBatchDelete}>
              <Button danger>批量删除（{selectedRowKeys.length}）</Button>
            </Popconfirm>
          </>
        ) : null}
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
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
      />
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
