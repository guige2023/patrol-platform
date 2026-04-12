import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message, Upload, List, Alert } from 'antd';
import { PlusOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getCadres, deleteCadre, importCadres, exportCadres, downloadCadreTemplate } from '@/api/cadres';
import CadreModal from './CadreModal';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';

interface Cadre {
  id: string;
  name: string;
  gender?: string;
  position?: string;
  rank?: string;
  category?: string;
  unit_id?: string;
  tags?: string[];
  is_available: boolean;
}

const CadreList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Cadre[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [cadreModalOpen, setCadreModalOpen] = useState(false);
  const [cadreId, setCadreId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCadres({ page, page_size: pageSize, ...searchParams });
      setData(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  const handleSearch = (values: any) => setSearchParams(values);
  const handleReset = () => setSearchParams({});

  const handleDelete = async (id: string) => {
    Modal.confirm({ title: '确认删除？', onOk: async () => {
      await deleteCadre(id);
      message.success('删除成功');
      fetchData();
    }});
  };

  const handleImport = async (file: File) => {
    try {
      const result = await importCadres(file);
      message.success(`导入完成：新建${result.created}条，跳过${result.skipped}条`);
      setImportModalOpen(false);
      setValidationErrors([]);
      fetchData();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && Array.isArray(detail.errors)) {
        // 字段校验错误 → 弹窗展示
        setValidationErrors(detail.errors as string[]);
      } else {
        message.error(getErrorMessage(e) || '导入失败');
      }
    }
    return false;
  };

  const columns: ColumnsType<Cadre> = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '性别', dataIndex: 'gender', key: 'gender' },
    { title: '职务', dataIndex: 'position', key: 'position' },
    { title: '职级', dataIndex: 'rank', key: 'rank' },
    { title: '类别', dataIndex: 'category', key: 'category', render: (v: string) => v || '-' },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => tags?.map(t => <Tag key={t}>{t}</Tag>) || [],
    },
    {
      title: '可用',
      dataIndex: 'is_available',
      key: 'is_available',
      render: (v: boolean) => <span style={{ color: v ? '#52c41a' : '#ff4d4f' }}>{v ? '是' : '否'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setCadreId(record.id); setCadreModalOpen(true); }}>查看</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="干部人才库" breadcrumbs={[{ name: '档案管理' }, { name: '干部人才库' }]} />
      <SearchForm
        fields={[{ name: 'name', label: '姓名', placeholder: '请输入姓名' }]}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCadreId(null); setCadreModalOpen(true); }}>
            新建干部
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => downloadCadreTemplate()}>
            下载模板
          </Button>
          <Button
            icon={<UploadOutlined />}
            onClick={async () => {
              try {
                const blob = await exportCadres();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '干部人才导出.xlsx';
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                message.error('导出失败，请重试');
              }
            }}
          >
            导出
          </Button>
        </Space>
      </div>
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
      <Modal
        title="导入干部"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setValidationErrors([]); }}
        footer={null}
        width={640}
      >
        <div style={{ padding: '16px 0' }}>
          {validationErrors.length > 0 && (
            <Alert
              type="error"
              message={`有 ${validationErrors.length} 条数据校验不通过，请修改 Excel 后重新导入`}
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}
          <List
            size="small"
            bordered
            dataSource={validationErrors}
            style={{ maxHeight: 280, overflow: 'auto', marginBottom: 16 }}
            renderItem={(item: string) => (
              <List.Item style={{ padding: '8px 12px', fontSize: 13 }}>
                <span style={{ color: '#cf1322' }}>{item}</span>
              </List.Item>
            )}
          />
          {validationErrors.length === 0 && (
            <>
              <Upload
                accept=".xlsx"
                showUploadList={false}
                beforeUpload={handleImport}
              >
                <Button icon={<UploadOutlined />}>选择 Excel 文件 (.xlsx)</Button>
              </Upload>
              <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
                <p>必填列：姓名*；可选列：性别、出生日期、民族、籍贯、政治面貌、学历、学位、职务、职级、类别、标签、简历、是否可用</p>
                <p>说明：姓名重复的数据会自动跳过；职务/职级/类别字段需与"系统管理→字段配置"中的可选值一致</p>
              </div>
            </>
          )}
          {validationErrors.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setValidationErrors([])}>关闭</Button>
            </div>
          )}
        </div>
      </Modal>
      <CadreModal
        open={cadreModalOpen}
        cadreId={cadreId}
        onClose={() => { setCadreModalOpen(false); setCadreId(null); }}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default CadreList;
