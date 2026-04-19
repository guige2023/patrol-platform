import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, message } from 'antd';
import PageHeader from '@/components/common/PageHeader';
import { getAuditLogs, exportAuditLogs } from '@/api/admin';

const AuditLog: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({ page, page_size: 50 });
      setData(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  const actionColors: Record<string, string> = {
    create: 'green', update: 'blue', delete: 'red', submit: 'orange',
    approve: 'green', publish: 'purple', transfer: 'cyan',
  };

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t?.replace('T', ' ').substring(0, 19) },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id' },
    { title: '操作', dataIndex: 'action', key: 'action', render: (a: string) => <Tag color={actionColors[a] || 'default'}>{a}</Tag> },
    { title: '对象类型', dataIndex: 'entity_type', key: 'entity_type' },
    { title: '对象ID', dataIndex: 'entity_id', key: 'entity_id' },
    { title: '变化详情', dataIndex: 'changes', key: 'changes', ellipsis: true },
  ];

  return (
    <div>
      <PageHeader title="审计日志" breadcrumbs={[{ name: '系统管理' }, { name: '审计日志' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button onClick={() => exportAuditLogs().catch(() => message.error('导出失败'))}>导出</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize: 50, total, onChange: setPage, showTotal: (t) => `共 ${t} 条` }} />
    </div>
  );
};

export default AuditLog;
