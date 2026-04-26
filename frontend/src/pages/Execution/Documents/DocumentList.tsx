import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Card, Select, DatePicker, message, Modal, Input } from 'antd';
import { EyeOutlined, DownloadOutlined, PrinterOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '@/components/common/PageHeader';
import { getDocuments, downloadDocument, previewDocument } from '@/api/documents';
import type { Document } from '@/api/documents';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const DocumentList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDocuments({
        page,
        page_size: pageSize,
        type: typeFilter,
        search: searchText,
      });
      setData(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, typeFilter, dateRange, searchText]);

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1);
  };

  const handleDownload = async (doc: Document) => {
    try {
      await downloadDocument(doc.id);
      message.success('下载成功');
    } catch {
      message.error('下载失败');
    }
  };

  const handlePreview = async (doc: Document) => {
    try {
      const res = await previewDocument(doc.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      setPreviewUrl(url);
    } catch {
      message.error('预览失败');
    }
  };

  const handlePrint = (doc: Document) => {
    window.open(`/api/documents/${doc.id}/print`, '_blank');
  };

  const docTypeOptions = [
    { label: '全部类型', value: '' },
    { label: '巡察公告', value: 'announcement' },
    { label: '成立通知', value: 'establishment' },
    { label: '部署会通知', value: 'meeting' },
    { label: '反馈意见', value: 'feedback' },
    { label: '整改通知书', value: 'rectification_notice' },
    { label: '其他', value: 'other' },
  ];

  const getDocTypeLabel = (type: string) => {
    return docTypeOptions.find(o => o.value === type)?.label || type;
  };

  const getDocTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      announcement: 'red',
      establishment: 'blue',
      meeting: 'orange',
      feedback: 'purple',
      rectification_notice: 'green',
      other: 'default',
    };
    return colors[type] || 'default';
  };

  const columns: ColumnsType<Document> = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '文号', dataIndex: 'doc_number', key: 'doc_number' },
    { title: '类型', dataIndex: 'doc_type', key: 'doc_type', render: (t: string) => <Tag color={getDocTypeColor(t)}>{getDocTypeLabel(t)}</Tag> },
    { title: '生成日期', dataIndex: 'generate_date', key: 'generate_date', render: (d: string) => d?.split('T')[0] },
    { title: '生成人', dataIndex: 'generator_name', key: 'generator_name', render: (n: string) => n || '-' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>预览</Button>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>下载</Button>
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="文档管理"
        breadcrumbs={[{ name: '执行管理' }, { name: '文档管理' }]}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索标题/文号"
            onSearch={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <span>文档类型：</span>
          <Select
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={docTypeOptions}
            style={{ width: 150 }}
            allowClear
          />
          <span>日期范围：</span>
          <RangePicker
            onChange={(dates) => { setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null); setPage(1); }}
          />
          <Button
            icon={<FileExcelOutlined />}
            onClick={() => {
              window.open('/api/documents/export', '_blank');
            }}
          >
            导出
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      {/* Preview Modal */}
      <Modal
        title="文档预览"
        open={!!previewUrl}
        onCancel={() => setPreviewUrl(null)}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            style={{ width: '100%', height: '600px', border: 'none' }}
            title="Document Preview"
          />
        )}
      </Modal>
    </div>
  );
};

export default DocumentList;
