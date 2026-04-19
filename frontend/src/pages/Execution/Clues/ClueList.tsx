import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Tag, Modal, message, Input, Select, Collapse, Row, Col, DatePicker } from 'antd';
import { PlusOutlined, LinkOutlined, FilterOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import { getClues, transferClue, exportClues } from '@/api/clues';
import { getUnits } from '@/api/units';
import ClueModal from './ClueModal';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';
import dayjs from 'dayjs';

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

const statusLabels: Record<string, string> = {
  registered: '已登记',
  transferring: '移交中',
  transferred: '已移交',
  closed: '已关闭',
};

const severityLabels: Record<string, string> = {
  low: '一般',
  medium: '较重',
  high: '重要',
  critical: '重大',
};

const STATUS_OPTIONS = [
  { label: '已登记', value: 'registered' },
  { label: '移交中', value: 'transferring' },
  { label: '已移交', value: 'transferred' },
  { label: '已关闭', value: 'closed' },
];

const CATEGORY_OPTIONS = [
  { label: '违反廉洁纪律', value: '违反廉洁纪律' },
  { label: '违反工作纪律', value: '违反工作纪律' },
  { label: '违反生活纪律', value: '违反生活纪律' },
  { label: '其他', value: '其他' },
];

const ClueList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Clue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClueId, setModalClueId] = useState<string | undefined>();
  const navigate = useNavigate();

  // Search state
  const [titleKw, setTitleKw] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getClues({
        page,
        page_size: pageSize,
        title: titleKw || undefined,
        status: statusFilter,
        category: categoryFilter,
        start_date: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        end_date: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      });
      setData(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, titleKw, statusFilter, categoryFilter, dateRange]);

  const handleCreate = () => {
    setModalClueId(undefined);
    setModalOpen(true);
  };

  const handleView = (id: string) => {
    setModalClueId(id);
    setModalOpen(true);
  };

  const [transferTarget, setTransferTarget] = useState('');
  const [unitOptions, setUnitOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    getUnits({ page: 1, page_size: 999 }).then((res: any) => {
      setUnitOptions((res.items || []).map((u: any) => ({ label: u.name, value: u.name })));
    }).catch(() => {});
  }, []);

  const handleTransfer = (id: string) => {
    setTransferTarget('');
    Modal.confirm({
      title: '移交线索',
      content: (
        <Select
          placeholder="请选择移交目标单位"
          options={unitOptions}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          onChange={(val) => setTransferTarget(val)}
          style={{ width: '100%' }}
        />
      ),
      onOk: async () => {
        if (!transferTarget.trim()) {
          message.warning('请选择移交目标单位');
          return;
        }
        try {
          await transferClue(id, transferTarget);
          message.success('移交成功');
          fetchData();
        } catch (e: any) {
          message.error(getErrorMessage(e) || '移交失败');
        }
      },
    });
  };

  const activeFilters = [
    statusFilter ? '状态' : '',
    categoryFilter ? '类别' : '',
    dateRange ? '时间' : '',
  ].filter(Boolean).length;

  const columns: ColumnsType<Clue> = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '来源', dataIndex: 'source', key: 'source' },
    { title: '类别', dataIndex: 'category', key: 'category' },
    { title: '严重程度', dataIndex: 'severity', key: 'severity', render: (v: string) => severityLabels[v] || v || '-' },
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
          <Button type="link" size="small" onClick={() => handleView(record.id)}>查看</Button>
          <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => navigate(`/execution/rectifications?clue_id=${record.id}`)}>关联整改</Button>
          <Button type="link" size="small" onClick={() => handleTransfer(record.id)}>移交</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="线索管理" breadcrumbs={[{ name: '执纪执行' }, { name: '线索管理' }]} />
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>登记线索</Button>
          <Button onClick={() => exportClues({ status: statusFilter, category: categoryFilter }).catch(() => message.error('导出失败'))}>导出</Button>
          <Input placeholder="搜索标题" style={{ width: 160 }} onChange={e => { setTitleKw(e.target.value); setPage(1); }} />
        </Space>
        <Collapse
          ghost
          items={[{
            key: 'filters',
            label: <Space><FilterOutlined />高级筛选（{activeFilters}）</Space>,
            children: (
              <Row gutter={[12, 12]}>
                <Col>
                  <Select
                    placeholder="按状态"
                    allowClear
                    style={{ width: 120 }}
                    options={STATUS_OPTIONS}
                    onChange={val => { setStatusFilter(val); setPage(1); }}
                    value={statusFilter}
                  />
                </Col>
                <Col>
                  <Select
                    placeholder="按类别"
                    allowClear
                    style={{ width: 140 }}
                    options={CATEGORY_OPTIONS}
                    onChange={val => { setCategoryFilter(val); setPage(1); }}
                    value={categoryFilter}
                  />
                </Col>
                <Col>
                  <DatePicker.RangePicker
                    onChange={(vals) => { setDateRange(vals as [dayjs.Dayjs, dayjs.Dayjs] | null); setPage(1); }}
                    value={dateRange}
                  />
                </Col>
              </Row>
            ),
          }]}
        />
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
