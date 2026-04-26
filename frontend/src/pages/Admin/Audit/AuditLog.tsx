import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message, Select, Space, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getAuditLogs, exportAuditLogs } from '@/api/admin';

const ACTION_COLORS: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red', submit: 'orange',
  approve: 'green', publish: 'purple', transfer: 'cyan', sign: 'blue',
  verify: 'cyan', confirm: 'green', draft_submit: 'orange', draft_approve: 'green',
  draft_reject: 'red', draft_publish: 'purple', update_progress: 'blue',
  reimport: 'orange', generate: 'purple', upload: 'cyan', download: 'default',
};

const ENTITY_TYPES = [
  { value: '', label: '全部' },
  { value: 'user', label: '用户' },
  { value: 'role', label: '角色' },
  { value: 'unit', label: '单位' },
  { value: 'cadre', label: '干部' },
  { value: 'plan', label: '巡察计划' },
  { value: 'group', label: '巡察组' },
  { value: 'draft', label: '底稿' },
  { value: 'clue', label: '线索' },
  { value: 'rectification', label: '整改' },
  { value: 'knowledge', label: '知识库' },
  { value: 'document', label: '文档' },
  { value: 'progress', label: '进度' },
  { value: 'notification', label: '通知' },
  { value: 'alert', label: '告警' },
];

const AuditLog: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page, page_size: 50, entity_type: entityType || undefined, search: searchText || undefined });
      setData(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, entityType, searchText]);

  const formatChanges = (changes: any) => {
    if (!changes || Object.keys(changes).length === 0) return '-';
    const entries = Object.entries(changes);
    return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => t?.replace('T', ' ').substring(0, 19) || '-',
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '操作',
      dataIndex: 'action_label',
      key: 'action_label',
      width: 100,
      render: (label: string, record: any) => (
        <Tag color={ACTION_COLORS[record.action] || 'default'}>{label || record.action}</Tag>
      ),
    },
    {
      title: '对象类型',
      dataIndex: 'entity_type_label',
      key: 'entity_type_label',
      width: 100,
      render: (label: string, record: any) => label || record.entity_type,
    },
    {
      title: '对象ID',
      dataIndex: 'entity_id',
      key: 'entity_id',
      width: 220,
      render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>,
    },
    {
      title: '变化详情',
      dataIndex: 'changes',
      key: 'changes',
      ellipsis: true,
      render: (changes: any) => (
        <span style={{ fontSize: 12, color: '#666' }}>{formatChanges(changes)}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="审计日志" breadcrumbs={[{ name: '系统管理' }, { name: '审计日志' }]} />
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input.Search
          placeholder="搜索用户/对象ID"
          onSearch={(value) => { setSearchText(value); setPage(1); }}
          style={{ width: 200 }}
          allowClear
          enterButton={<Button icon={<SearchOutlined />}>搜索</Button>}
        />
        <Space>
          <span style={{ color: '#666' }}>对象类型：</span>
          <Select
            value={entityType}
            onChange={(v) => { setEntityType(v); setPage(1); }}
            options={ENTITY_TYPES}
            style={{ width: 140 }}
            allowClear
            placeholder="筛选对象类型"
          />
        </Space>
        <Button onClick={() => exportAuditLogs({ entity_type: entityType || undefined }).catch(() => message.error('导出失败'))}>
          导出
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 50,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />
    </div>
  );
};

export default AuditLog;
