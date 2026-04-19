import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Table, Button, Space, Tag, Progress, message, Popconfirm, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Key } from 'antd/es/table/interface';
import PageHeader from '@/components/common/PageHeader';
import { getRectifications, signRectification, verifyRectification, exportRectifications, deleteRectification, submitRectification, batchDeleteRectifications, batchUpdateRectificationStatus } from '@/api/rectifications';
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
  submitted: 'warning',
  verified: 'green',
  rejected: 'error',
};

const statusLabels: Record<string, string> = {
  dispatched: '已派发',
  signed: '已签收',
  progressing: '整改中',
  completed: '已完成',
  submitted: '待验收',
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
  const [searchParams] = useSearchParams();
  const clueIdParam = searchParams.get('clue_id');
  const [modalOpen, setModalOpen] = useState(!!clueIdParam);
  const [rectificationId, setRectificationId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [batchStatusVal, setBatchStatusVal] = useState<string | undefined>();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getRectifications({ page, page_size: pageSize });
      setData(res?.items ?? []);
      setTotal(res?.total ?? 0);
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

  const handleDelete = async (id: string) => {
    try {
      await deleteRectification(id);
      message.success('删除成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '删除失败');
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await submitRectification(id);
      message.success('提交验收成功');
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '提交失败');
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    try {
      await batchDeleteRectifications(selectedRowKeys as string[]);
      message.success('批量删除成功');
      setSelectedRowKeys([]);
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '批量删除失败');
    }
  };

  const handleBatchStatus = async () => {
    if (!selectedRowKeys.length || !batchStatusVal) return;
    try {
      await batchUpdateRectificationStatus(selectedRowKeys as string[], batchStatusVal);
      message.success(`已将 ${selectedRowKeys.length} 条改为「${statusLabels[batchStatusVal]}」`);
      setSelectedRowKeys([]);
      setBatchStatusVal(undefined);
      fetchData();
    } catch (e: any) {
      message.error(getErrorMessage(e) || '批量改状态失败');
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
          <Button type="link" size="small" onClick={() => { setRectificationId(record.id); setEditMode(false); setModalOpen(true); }}>查看</Button>
          <Button type="link" size="small" onClick={() => { setRectificationId(record.id); setEditMode(true); setModalOpen(true); }}>编辑</Button>
          {record.status === 'dispatched' && <Button type="link" size="small" onClick={() => handleSign(record.id)}>签收</Button>}
          {record.status === 'completed' && <Button type="link" size="small" onClick={() => handleSubmit(record.id)}>提交验收</Button>}
          {record.status === 'submitted' && <Button type="link" size="small" onClick={() => handleVerify(record.id)}>审核验收</Button>}
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="整改督办" breadcrumbs={[{ name: '执纪执行' }, { name: '整改督办' }]} />
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setRectificationId(null); setEditMode(false); setModalOpen(true); }} style={{ marginRight: 8 }}>派发整改</Button>
        <Button onClick={() => exportRectifications().catch(() => message.error('导出失败'))} style={{ marginRight: 8 }}>导出</Button>
        {selectedRowKeys.length > 0 && (
          <>
            <Select
              placeholder="批量改状态"
              style={{ width: 130, marginRight: 8 }}
              options={[
                { label: '已派发', value: 'dispatched' },
                { label: '已签收', value: 'signed' },
                { label: '整改中', value: 'progressing' },
                { label: '已完成', value: 'completed' },
                { label: '待验收', value: 'submitted' },
                { label: '已验收', value: 'verified' },
                { label: '已驳回', value: 'rejected' },
              ]}
              onChange={val => setBatchStatusVal(val)}
              value={batchStatusVal}
            />
            {batchStatusVal && (
              <Button type="primary" onClick={handleBatchStatus} style={{ marginRight: 8 }}>
                确认改状态（{selectedRowKeys.length}）
              </Button>
            )}
            <Popconfirm title={`确认删除选中的 ${selectedRowKeys.length} 条整改记录？`} onConfirm={handleBatchDelete}>
              <Button danger>批量删除（{selectedRowKeys.length}）</Button>
            </Popconfirm>
          </>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
        pagination={{ current: page, pageSize, total, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showTotal: (t) => `共 ${t} 条` }}
      />
      <RectificationModal
        open={modalOpen}
        rectificationId={rectificationId}
        defaultEditMode={editMode}
        defaultClueId={clueIdParam}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default RectificationList;
