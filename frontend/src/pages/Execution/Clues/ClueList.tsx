import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getClues, transferClue } from '@/api/clues';
import ClueModal from './ClueModal';
import type { ColumnsType } from 'antd/es/table';

interface Clue {
  id: string;
  title: string;
  source?: string;
  category?: string;
  severity?: string;
  status: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  registered: 'processing',
  transferring: 'warning',
  transferred: 'success',
  closed: 'default',
};

const ClueList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Clue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClueId, setModalClueId] = useState<string | undefined>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getClues({ page, page_size: pageSize });
      setData(res.data.items);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const handleCreate = () => {
    setModalClueId(undefined);
    setModalOpen(true);
  };

  const handleView = (id: string) => {
    setModalClueId(id);
    setModalOpen(true);
  };

  const [transferTarget, setTransferTarget] = useState('');
  const handleTransfer = (id: string) => {
    setTransferTarget('');
    Modal.confirm({
      title: '移交线索',
      content: (
        <Input
          placeholder="请输入移交目标"
          onChange={(e) => setTransferTarget(e.target.value)}
        />
      ),
      onOk: async () => {
        if (!transferTarget.trim()) {
          message.warning('请输入移交目标');
          return;
        }
        try {
          await transferClue(id, transferTarget);
          message.success('移交成功');
          fetchData();
        } catch (e: any) {
          message.error(e.response?.data?.detail || '移交失败');
        }
      },
    });
  };

  const columns: ColumnsType<Clue> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '来源', dataIndex: 'source', key: 'source' },
    { title: '类别', dataIndex: 'category', key: 'category' },
    { title: '严重程度', dataIndex: 'severity', key: 'severity' },
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
          <Button type="link" size="small" onClick={() => handleView(record.id)}>查看</Button>
          <Button type="link" size="small" onClick={() => handleTransfer(record.id)}>移交</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="线索管理" breadcrumbs={[{ name: '执纪执行' }, { name: '线索管理' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>登记线索</Button>
      </div>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `共 ${t} 条` }} />
      <ClueModal
        open={modalOpen}
        clueId={modalClueId}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default ClueList;
