import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Form, Input, Select, Upload, InputNumber, Alert, List } from 'antd';
import { PlusOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getUnits, deleteUnit, createUnit, updateUnit, importUnits, exportUnits, downloadUnitTemplate } from '@/api/units';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';

interface Unit {
  id: string;
  name: string;
  org_code: string;
  unit_type?: string;
  level?: string;
  last_inspection_year?: number;
  inspection_history?: string;
  is_active: boolean;
}

const UnitList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<any>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form] = Form.useForm();

  const { getOptions } = useFieldOptions();
  const unitTypeOptions = getOptions('unit_type');
  const unitLevelOptions = getOptions('unit_level');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUnits({ page, page_size: pageSize, ...searchParams });
      setData(res.items);
      setTotal(res.total);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  const handleSearch = (values: any) => setSearchParams(values);
  const handleReset = () => setSearchParams({});

  const handleDelete = async (id: string) => {
    Modal.confirm({ title: '确认删除？', onOk: async () => {
      try {
        await deleteUnit(id);
        message.success('删除成功');
        fetchData();
      } catch (e: any) {
        message.error(getErrorMessage(e) || '删除失败');
      }
    }});
  };

  const openCreateModal = () => {
    form.resetFields();
    setCreateModalOpen(true);
  };

  const openEditModal = (record: Unit) => {
    setEditingUnit(record);
    form.setFieldsValue(record);
    setEditModalOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createUnit(values);
      message.success('新建单位成功');
      setCreateModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(getErrorMessage(err) || '新建单位失败');
    }
  };

  const handleEditSubmit = async () => {
    if (!editingUnit) return;
    try {
      const values = await form.validateFields();
      await updateUnit(editingUnit.id, values);
      message.success('编辑单位成功');
      setEditModalOpen(false);
      setEditingUnit(null);
      fetchData();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(getErrorMessage(err) || '编辑单位失败');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const result = await importUnits(file);
      message.success(`导入完成：新建${result.created}条，跳过${result.skipped}条`);
      setImportModalOpen(false);
      setValidationErrors([]);
      fetchData();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail && typeof detail === 'object' && Array.isArray(detail.errors)) {
        setValidationErrors(detail.errors as string[]);
      } else {
        message.error(getErrorMessage(e) || '导入失败');
      }
    }
    return false;
  };

  const columns: ColumnsType<Unit> = [
    { title: '单位名称', dataIndex: 'name', key: 'name' },
    { title: '组织编码', dataIndex: 'org_code', key: 'org_code' },
    { title: '类型', dataIndex: 'unit_type', key: 'unit_type', render: (v: string) => v || '-' },
    { title: '级别', dataIndex: 'level', key: 'level', render: (v: string) => v || '-' },
    { title: '最近巡察年份', dataIndex: 'last_inspection_year', key: 'last_inspection_year', render: (v: number) => v || '-' },
    { title: '巡察历史', dataIndex: 'inspection_history', key: 'inspection_history', render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEditModal(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const searchFields = [
    { name: 'name', label: '单位名称', placeholder: '请输入单位名称' },
    {
      name: 'unit_type',
      label: '类型',
      render: () => (
        <Select
          options={unitTypeOptions}
          placeholder="请选择类型"
          allowClear
          style={{ width: '100%' }}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="单位档案" breadcrumbs={[{ name: '档案管理' }, { name: '单位档案' }]} />
      <SearchForm fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建单位
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={() => downloadUnitTemplate()}>
            下载模板
          </Button>
          <Button icon={<UploadOutlined />} onClick={exportUnits}>
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
      <Modal title="新建单位" open={createModalOpen} footer={null} onCancel={() => setCreateModalOpen(false)}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
            <Input placeholder="请输入单位名称" />
          </Form.Item>
          <Form.Item name="org_code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
            <Input placeholder="请输入组织编码" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="unit_type" label="单位类型" rules={[{ required: true, message: '请选择单位类型' }]}>
              <Select options={unitTypeOptions} placeholder="请选择单位类型" />
            </Form.Item>
            <Form.Item name="level" label="级别">
              <Select options={unitLevelOptions} placeholder="请选择级别" allowClear />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="last_inspection_year" label="最近巡察年份">
              <InputNumber style={{ width: '100%' }} placeholder="如 2021" min={1900} max={2100} />
            </Form.Item>
            <Form.Item name="inspection_history" label="巡察历史">
              <Input placeholder="如 2021年第一轮、2023年第二轮" />
            </Form.Item>
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>取消</Button>
              <Button type="primary" onClick={handleCreateSubmit}>确定</Button>
            </Space>
          </div>
        </Form>
      </Modal>
      <Modal title="编辑单位" open={editModalOpen} footer={null} onCancel={() => { setEditModalOpen(false); setEditingUnit(null); }}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
            <Input placeholder="请输入单位名称" />
          </Form.Item>
          <Form.Item name="org_code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
            <Input placeholder="请输入组织编码" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="unit_type" label="单位类型" rules={[{ required: true, message: '请选择单位类型' }]}>
              <Select options={unitTypeOptions} placeholder="请选择单位类型" />
            </Form.Item>
            <Form.Item name="level" label="级别">
              <Select options={unitLevelOptions} placeholder="请选择级别" allowClear />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="last_inspection_year" label="最近巡察年份">
              <InputNumber style={{ width: '100%' }} placeholder="如 2021" min={1900} max={2100} />
            </Form.Item>
            <Form.Item name="inspection_history" label="巡察历史">
              <Input placeholder="如 2021年第一轮、2023年第二轮" />
            </Form.Item>
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => { setEditModalOpen(false); setEditingUnit(null); }}>取消</Button>
              <Button type="primary" onClick={handleEditSubmit}>确定</Button>
            </Space>
          </div>
        </Form>
      </Modal>
      <Modal
        title="导入单位"
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
                <p>必填列：单位名称*、组织编码*；可选列：单位类型、单位级别、排序、标签、简介、最近巡察年份、巡察历史、是否可用</p>
                <p>说明：组织编码重复的数据会自动跳过；单位类型/单位级别字段需与"系统管理→字段配置"中的可选值一致</p>
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
    </div>
  );
};

export default UnitList;
