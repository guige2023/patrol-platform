import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message, Select, Space } from 'antd';
import { AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getAlerts, resolveAlert } from '@/api/admin';

const Alerts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [isResolved, setIsResolved] = useState<boolean | undefined>(undefined);
  const [level, setLevel] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAlerts({ is_resolved: isResolved, level });
      setData(Array.isArray(res) ? res : []);
    } catch {
      message.error('获取告警失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [isResolved, level]);

  const handleResolve = async (id: string) => {
    try {
      await resolveAlert(id);
      message.success('已标记为已解决');
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const levelColors: Record<string, string> = {
    critical: 'red',
    high: 'orange',
    medium: 'yellow',
    low: 'green',
    info: 'blue',
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'is_resolved',
      key: 'is_resolved',
      width: 100,
      render: (resolved: boolean) => resolved
        ? <Tag icon={<CheckCircleOutlined />} color="success">已解决</Tag>
        : <Tag icon={<AlertOutlined />} color="error">未解决</Tag>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => (
        <Tag color={levelColors[level] || 'default'}>{level?.toUpperCase()}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <strong>{title}</strong>,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '实体',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 120,
      render: (type: string, record: any) => type ? `${type}: ${record.entity_id}` : '-',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (t: string) => t ? t.replace('T', ' ').substring(0, 19) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        record.is_resolved
          ? <span style={{ color: '#999' }}>-</span>
          : <Button type="link" size="small" onClick={() => handleResolve(record.id)}>
              标记解决
            </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="系统告警" breadcrumbs={[{ name: '系统管理' }, { name: '系统告警' }]} />
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Space>
          <span>状态:</span>
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            value={isResolved}
            onChange={(v) => setIsResolved(v)}
            options={[
              { label: '未解决', value: false },
              { label: '已解决', value: true },
            ]}
          />
          <span>级别:</span>
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 120 }}
            value={level}
            onChange={(v) => setLevel(v)}
            options={[
              { label: '严重', value: 'critical' },
              { label: '高', value: 'high' },
              { label: '中', value: 'medium' },
              { label: '低', value: 'low' },
              { label: '信息', value: 'info' },
            ]}
          />
        </Space>
        <Button onClick={fetchData}>刷新</Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
      />
    </div>
  );
};

export default Alerts;