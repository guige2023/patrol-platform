import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Form, Input, Select, Upload, InputNumber } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import PageHeader from '@/components/common/PageHeader';
import SearchForm from '@/components/common/SearchForm';
import { getUnits, deleteUnit, createUnit, updateUnit, importUnits, exportUnits } from '@/api/units';
import type { ColumnsType } from 'antd/es/table';

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

const UNIT_TYPE_OPTIONS = [
  { label: '党委', value: 'party' },
  { label: '纪委', value: 'discipline' },
  { label: '组织部', value: 'organization' },
  { label: '宣传部', value: 'propaganda' },
  { label: '政府', value: 'government' },
  { label: '其他', value: 'other' },
];

const UNIT_LEVEL_OPTIONS = [
  { label: '一级单位', value: '一级单位' },
  { label: '二级单位', value: '二级单位' },
];

const UNIT_TYPE_LABELS: Record<string, string> = {
  party: '党委',
  discipline: '纪委',
  organization: '组织部',
  propaganda: '宣传部',
  government: '政府',
  other: '其他',
};

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
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUnits({ page, page_size: pageSize, ...searchParams });
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
      await deleteUnit(id);
      message.success('删除成功');
      fetchData();
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
      message.error('新建单位失败');
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
      message.error('编辑单位失败');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const result = await importUnits(file);
      message.success(`导入完成：新建${result.created}条，跳过${result.skipped}条`);
      setImportModalOpen(false);
      fetchData();
    } catch {
      // error handled by axios interceptor
    }
    return false; // prevent default upload behavior
  };

  const columns: ColumnsType<Unit> = [
    { title: '单位名称', dataIndex: 'name', key: 'name' },
    { title: '组织编码', dataIndex: 'org_code', key: 'org_code' },
    { title: '类型', dataIndex: 'unit_type', key: 'unit_type', render: (v: string) => UNIT_TYPE_LABELS[v] || v },
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

  return (
    <div>
      <PageHeader title="单位档案" breadcrumbs={[{ name: '档案管理' }, { name: '单位档案' }]} />
      <SearchForm
        fields={[{ name: 'name', label: '单位名称', placeholder: '请输入单位名称' }]}
        onSearch={handleSearch}
        onReset={handleReset}
      />
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建单位
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
            导入
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
          <Form.Item name="unit_type" label="单位类型" rules={[{ required: true, message: '请选择单位类型' }]}>
            <Select options={UNIT_TYPE_OPTIONS} placeholder="请选择单位类型" />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Select options={UNIT_LEVEL_OPTIONS} placeholder="请选择级别（一级/二级单位）" />
          </Form.Item>
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
          <Form.Item name="unit_type" label="单位类型" rules={[{ required: true, message: '请选择单位类型' }]}>
            <Select options={UNIT_TYPE_OPTIONS} placeholder="请选择单位类型" />
          </Form.Item>
          <Form.Item name="level" label="级别">
            <Select options={UNIT_LEVEL_OPTIONS} placeholder="请选择级别（一级/二级单位）" />
          </Form.Item>
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
        onCancel={() => setImportModalOpen(false)}
        footer={null}
      >
        <div style={{ padding: '16px 0' }}>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button icon={<UploadOutlined />}>选择 Excel 文件 (.xlsx)</Button>
          </Upload>
          <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
            <p>必填列：name(单位名称), org_code(组织编码)</p>
            <p>可选列：unit_type, level, sort_order, tags, profile, is_active, last_inspection_year, inspection_history</p>
            <p>说明：org_code 重复的数据会自动跳过</p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UnitList;
