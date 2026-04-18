import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message, Tabs, Card } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/api/admin';

const Notifications: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = activeTab === 'unread' ? { is_read: false } : {};
      const res = await getNotifications(params);
      setData(Array.isArray(res) ? res : []);
    } catch {
      message.error('获取通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      message.success('已标记为已读');
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      message.success('全部已标记为已读');
      fetchData();
    } catch {
      message.error('操作失败');
    }
  };

  const typeColors: Record<string, string> = {
    info: 'blue',
    warning: 'orange',
    error: 'red',
    success: 'green',
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'is_read',
      key: 'is_read',
      width: 80,
      render: (is_read: boolean) => is_read
        ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
        : <Tag color="red">未读</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => <Tag color={typeColors[type] || 'default'}>{type}</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: any) => (
        <a onClick={() => !record.is_read && handleMarkRead(record.id)}>{title}</a>
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
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
      width: 100,
      render: (_: any, record: any) => (
        record.is_read
          ? <span style={{ color: '#999' }}>已读</span>
          : <Button type="link" size="small" onClick={() => handleMarkRead(record.id)}>标为已读</Button>
      ),
    },
  ];

  const unreadCount = data.filter(n => !n.is_read).length;

  return (
    <div>
      <PageHeader title="通知消息" breadcrumbs={[{ name: '系统管理' }, { name: '通知消息' }]} />
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'all' | 'unread')}
            items={[
              { key: 'all', label: `全部通知` },
              { key: 'unread', label: `未读通知${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            ]}
          />
          <Button
            icon={<CheckCircleOutlined />}
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            全部标为已读
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>
    </div>
  );
};

export default Notifications;