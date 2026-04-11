import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getGroups } from '@/api/groups';
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

const GroupList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Group[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getGroups();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const columns: ColumnsType<Group> = [
    { title: '巡察组名称', dataIndex: 'name', key: 'name' },
    { title: '成员数量', dataIndex: 'member_count', key: 'member_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t?.split('T')[0] },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small">查看</Button>
          <Button type="link" size="small">添加成员</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="巡察组" breadcrumbs={[{ name: '巡察计划' }, { name: '巡察组' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => message.info('新建巡察组')}>新建巡察组</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} pagination={false} />
    </div>
  );
};

export default GroupList;
