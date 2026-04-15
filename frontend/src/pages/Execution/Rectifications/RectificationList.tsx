import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Progress, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getRectifications, signRectification, verifyRectification, exportRectifications } from '@/api/rectifications';
import RectificationModal from './RectificationModal';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';

interface Rectification {
  id: string;
  title: string;
  status: string;
  progress: number;
  alert_level: string;
  deadline?: string;
}

const statusColors: Record<string, string> = {
  dispatched: 'default',
  signed: 'processing',
  progressing: 'warning',
  completed: 'success',
  verified: 'green',
  rejected: 'error',
};

const statusLabels: Record<string, string> = {
  dispatched: '已派发',
  signed: '已签收',
  progressing: '整改中',
  completed: '已完成',
  verified: '已验收',
  rejected: '已驳回',
};

const alertColors: Record<string, string> = {
  green: '#52c41a',
  yellow: '#faad14',
  red: '#ff4d4f',
};

const RectificationList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Rectification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [rectificationId, setRectificationId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRectifications({ page, page_size: pageSize });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleSign = async (id: string) => {
    try {
      await signRectification(id);
      message.success('签收成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '签收失败');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await verifyRectification(id);
      message.success('审核销号成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '审核失败');
    }
  };

  const columns: ColumnsType<Rectification> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{statusLabels[s] || s}</Tag>,
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (p: number) => <Progress percent={p} size="small" />,
    },
    {
      title: '预警',
      dataIndex: 'alert_level',
      key: 'alert_level',
      render: (l: string) => <span style={{ color: alertColors[l] || '#999', fontSize: 18 }}>●</span>,
    },
    { title: '截止日期', dataIndex: 'deadline', key: 'deadline', render: (t: string) => t?.split('T')[0] },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setRectificationId(record.id); setModalOpen(true); }}>查看</Button>
          {record.status === 'dispatched' && <Button type="link" size="small" onClick={() => handleSign(record.id)}>签收</Button>}
          {record.status === 'completed' && <Button type="link" size="small" onClick={() => handleVerify(record.id)}>审核销号</Button>}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="整改督办" breadcrumbs={[{ name: '执纪执行' }, { name: '整改督办' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setRectificationId(null); setModalOpen(true); }} style={{ marginRight: 8 }}>派发整改</Button>
        <Button onClick={() => exportRectifications().catch(e => message.error('导出失败'))}>导出</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `共 ${t} 条` }} />
      <RectificationModal
        open={modalOpen}
        rectificationId={rectificationId}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default RectificationList;
