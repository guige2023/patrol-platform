import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Space, Modal, message, Form, Input, Select, Upload, InputNumber, Alert, List } from 'antd';
import { PlusOutlined, UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { getFieldOptions } from '@/api/fieldOptions';
import SearchForm from '@/components/common/SearchForm';
import { getUnits, deleteUnit, createUnit, updateUnit, importUnits, exportUnits, downloadUnitTemplate } from '@/api/units';
import type { ColumnsType } from 'antd/es/table';
import { getErrorMessage } from '@/utils/error';

interface Unit {
  id: string;
  name: string;
  org_code: string;
  parent_id?: string;
  unit_type?: string;
  level?: string;
  sort_order?: number;
  tags?: Record<string, string>;
  profile?: string;
  leadership?: Record<string, string>;
  contact?: Record<string, string>;
  last_inspection_year?: number;
  inspection_history?: string;
  is_active: boolean;
}

const UnitList: React.FC = () => {
  const navigate = useNavigate();
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

  // Fetch field options directly from API to avoid context timing issues
  const [unitTypeOptions, setUnitTypeOptions] = useState<{label:string;value:string}[]>([]);
  const [unitLevelOptions, setUnitLevelOptions] = useState<{label:string;value:string}[]>([]);
  useEffect(() => {
    getFieldOptions().then((res: any) => {
      // Backend returns raw array: [...], not {data: {items: [...]}}
      const items: any[] = Array.isArray(res) ? res : (res?.data?.items || res?.data || []);
      const ut = items.find((f: any) => f.field_key === 'unit_type');
      const ul = items.find((f: any) => f.field_key === 'unit_level');
      if (ut?.options) setUnitTypeOptions(ut.options);
      if (ul?.options) setUnitLevelOptions(ul.options);
    });
  }, []);

  // Build parent name lookup from ALL units (not just current page)
  const [parentNameMap, setParentNameMap] = useState<Record<string, string>>({});
  useEffect(() => {
    getUnits({ page: 1, page_size: 9999 }).then((res: any) => {
      const map: Record<string, string> = {};
      res.items?.forEach((u: Unit) => { if (u.id && u.name) map[u.id] = u.name; });
      setParentNameMap(map);
    }).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUnits({ page, page_size: pageSize, ...searchParams });
      setData(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(getErrorMessage(e) || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, pageSize, searchParams]);

  const handleSearch = (values: any) => { setPage(1); setSearchParams(values); };
  const handleReset = () => { setPage(1); setSearchParams({}); };

  const handleDelete = async (id: string) => {
    Modal.confirm({ title: '确认删除？', onOk: async () => {
      try {
        await deleteUnit(id);
        message.success('删除成功');
        // 删除后重置到第1页，避免页码越界
        setPage(1);
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
    // Set parent_id if exists
    const values: any = { ...record };
    if (record.tags && typeof record.tags === 'object') {
      // flatten tags into form fields (党组织情况)
      Object.entries(record.tags).forEach(([k, v]) => {
        values[`tag_${k}`] = v;
      });
    }
    if (record.leadership && typeof record.leadership === 'object') {
      Object.entries(record.leadership).forEach(([k, v]) => {
        values[`leadership_${k}`] = v;
      });
    }
    if (record.contact && typeof record.contact === 'object') {
      Object.entries(record.contact).forEach(([k, v]) => {
        values[`contact_${k}`] = v;
      });
    }
    form.setFieldsValue(values);
    setEditModalOpen(true);
  };

  const collectComplexFields = (values: any): any => {
    const result = { ...values };
    // Reconstruct tags dict from form fields
    const tagKeys = ['has_party', 'party_form', 'party_members'];
    const tagFields: Record<string, string> = {};
    tagKeys.forEach(k => {
      if (result[`tag_${k}`] !== undefined) {
        tagFields[k] = result[`tag_${k}`];
        delete result[`tag_${k}`];
      }
    });
    if (Object.keys(tagFields).length > 0) result.tags = tagFields;

    // Reconstruct leadership dict
    const leadKeys = ['name', 'position'];
    const leadFields: Record<string, string> = {};
    leadKeys.forEach(k => {
      if (result[`leadership_${k}`] !== undefined) {
        leadFields[k] = result[`leadership_${k}`];
        delete result[`leadership_${k}`];
      }
    });
    if (Object.keys(leadFields).length > 0) result.leadership = leadFields;

    // Reconstruct contact dict
    const contactKeys = ['person', 'phone', 'staff_count'];
    const contactFields: Record<string, string> = {};
    contactKeys.forEach(k => {
      if (result[`contact_${k}`] !== undefined) {
        contactFields[k] = result[`contact_${k}`];
        delete result[`contact_${k}`];
      }
    });
    if (Object.keys(contactFields).length > 0) result.contact = contactFields;

    return result;
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      const cleaned = collectComplexFields(values);
      await createUnit(cleaned);
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
      const cleaned = collectComplexFields(values);
      await updateUnit(editingUnit.id, cleaned);
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

  // Parent unit options for dropdown (all units except self)
  const parentUnitOptions = useMemo(() => {
    return data
      .filter(u => !editingUnit || u.id !== editingUnit.id)
      .map(u => ({ label: u.name, value: u.id }));
  }, [data, editingUnit]);

  const columns: ColumnsType<Unit> = useMemo(() => [
    {
      title: '单位名称', dataIndex: 'name', key: 'name', width: 240,
      render: (name: string, record: Unit) => (
        <a onClick={() => navigate(`/archive/units/${record.id}`)}>{name}</a>
      ),
    },
    { title: '组织编码', dataIndex: 'org_code', key: 'org_code', width: 110 },
    {
      title: '类型', dataIndex: 'unit_type', key: 'unit_type',
      render: (v: string) => {
        const opt = unitTypeOptions.find(o => o.value === v);
        return opt ? opt.label : '-';
      },
    },
    {
      title: '级别', dataIndex: 'level', key: 'level',
      render: (v: string) => {
        const opt = unitLevelOptions.find(o => o.value === v);
        return opt ? opt.label : '-';
      },
    },
    {
      title: '上级单位', dataIndex: 'parent_id', key: 'parent_id',
      render: (v: string) => v ? (parentNameMap[v] || '-') : '-',
    },
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', render: (v: number) => v ?? '-' },
    { title: '最近巡察年份', dataIndex: 'last_inspection_year', key: 'last_inspection_year', render: (v: number) => v || '-' },
    { title: '操作', key: 'action', width: 120, render: (_, record) => (
      <Space>
        <Button type="link" size="small" onClick={() => openEditModal(record)}>编辑</Button>
        <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
      </Space>
    ) },
  ], [unitTypeOptions, unitLevelOptions, parentNameMap, navigate]);

  const searchFields = [
    { name: 'name', label: '单位名称', placeholder: '请输入单位名称' },
    {
      name: 'unit_type', label: '类型', render: () => (
        <Select options={unitTypeOptions} placeholder="请选择类型" allowClear style={{ width: '100%' }} />
      ),
    },
  ];

  const formItemRow = (children: React.ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>{children}</div>
  );

  const buildTagFields = () => (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>党组织情况</div>
      {formItemRow(
        <>
          <Form.Item name="tag_has_party" label="是否具有党组织" style={{ marginBottom: 0 }}>
            <Select options={[{label:'是',value:'是'},{label:'否',value:'否'}]} placeholder="请选择" allowClear />
          </Form.Item>
          <Form.Item name="tag_party_form" label="党组织形式" style={{ marginBottom: 0 }}>
            <Input placeholder="如党委/党支部/党总支" />
          </Form.Item>
        </>
      )}
      <Form.Item name="tag_party_members" label="党员数" style={{ marginTop: 8 }}>
        <Input placeholder="请输入党员数量" />
      </Form.Item>
    </div>
  );

  const buildLeadershipFields = () => (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>负责人信息</div>
      {formItemRow(
        <>
          <Form.Item name="leadership_name" label="负责人姓名" style={{ marginBottom: 0 }}>
            <Input placeholder="请输入负责人姓名" />
          </Form.Item>
          <Form.Item name="leadership_position" label="职务" style={{ marginBottom: 0 }}>
            <Input placeholder="请输入职务" />
          </Form.Item>
        </>
      )}
    </div>
  );

  const buildContactFields = () => (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>联系信息</div>
      {formItemRow(
        <>
          <Form.Item name="contact_person" label="联系人" style={{ marginBottom: 0 }}>
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>
          <Form.Item name="contact_phone" label="联系电话" style={{ marginBottom: 0 }}>
            <Input placeholder="请输入联系电话" />
          </Form.Item>
        </>
      )}
      <Form.Item name="contact_staff_count" label="编制人数" style={{ marginTop: 8 }}>
        <InputNumber style={{ width: '100%' }} placeholder="请输入编制人数" min={0} />
      </Form.Item>
    </div>
  );

  const modalFooter = (onCancel: () => void, onOk: () => void) => (
    <div style={{ textAlign: 'right', marginTop: 16 }}>
      <Space>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={onOk}>确定</Button>
      </Space>
    </div>
  );

  const renderCreateModal = () => (
    <Modal title="新建单位" open={createModalOpen} footer={null} onCancel={() => setCreateModalOpen(false)} width={640}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
          <Input placeholder="请输入单位名称" />
        </Form.Item>
        <Form.Item name="org_code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
          <Input placeholder="请输入组织编码" />
        </Form.Item>
        {formItemRow(
          <>
            <Form.Item name="unit_type" label="单位类型" rules={[{ required: true, message: '请选择单位类型' }]} style={{ marginBottom: 0 }}>
              <Select options={unitTypeOptions} placeholder="请选择单位类型" />
            </Form.Item>
            <Form.Item name="level" label="级别" style={{ marginBottom: 0 }}>
              <Select options={unitLevelOptions} placeholder="请选择级别" allowClear />
            </Form.Item>
          </>
        )}
        {formItemRow(
          <>
            <Form.Item name="parent_id" label="上级单位" style={{ marginBottom: 0 }}>
              <Select options={parentUnitOptions} placeholder="请选择上级单位（可选）" allowClear showSearch />
            </Form.Item>
            <Form.Item name="sort_order" label="排序" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} placeholder="数字越小越靠前" min={0} />
            </Form.Item>
          </>
        )}
        <Form.Item name="profile" label="单位简介">
          <Input.TextArea rows={2} placeholder="请输入单位简介" />
        </Form.Item>
        {buildTagFields()}
        {buildLeadershipFields()}
        {buildContactFields()}
        {formItemRow(
          <>
            <Form.Item name="last_inspection_year" label="最近巡察年份" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} placeholder="如 2021" min={1900} max={2100} />
            </Form.Item>
            <Form.Item name="inspection_history" label="巡察历史" style={{ marginBottom: 0 }}>
              <Input placeholder="如 2021年第一轮、2023年第二轮" />
            </Form.Item>
          </>
        )}
        {modalFooter(() => setCreateModalOpen(false), handleCreateSubmit)}
      </Form>
    </Modal>
  );

  const renderEditModal = () => (
    <Modal title="编辑单位" open={editModalOpen} footer={null} onCancel={() => { setEditModalOpen(false); setEditingUnit(null); }} width={640}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="单位名称" rules={[{ required: true, message: '请输入单位名称' }]}>
          <Input placeholder="请输入单位名称" />
        </Form.Item>
        <Form.Item name="org_code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
          <Input placeholder="请输入组织编码" />
        </Form.Item>
        {formItemRow(
          <>
            <Form.Item name="unit_type" label="单位类型" rules={[{ required: true, message: '请选择单位类型' }]} style={{ marginBottom: 0 }}>
              <Select options={unitTypeOptions} placeholder="请选择单位类型" />
            </Form.Item>
            <Form.Item name="level" label="级别" style={{ marginBottom: 0 }}>
              <Select options={unitLevelOptions} placeholder="请选择级别" allowClear />
            </Form.Item>
          </>
        )}
        {formItemRow(
          <>
            <Form.Item name="parent_id" label="上级单位" style={{ marginBottom: 0 }}>
              <Select options={parentUnitOptions} placeholder="请选择上级单位（可选）" allowClear showSearch />
            </Form.Item>
            <Form.Item name="sort_order" label="排序" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} placeholder="数字越小越靠前" min={0} />
            </Form.Item>
          </>
        )}
        <Form.Item name="profile" label="单位简介">
          <Input.TextArea rows={2} placeholder="请输入单位简介" />
        </Form.Item>
        {buildTagFields()}
        {buildLeadershipFields()}
        {buildContactFields()}
        {formItemRow(
          <>
            <Form.Item name="last_inspection_year" label="最近巡察年份" style={{ marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} placeholder="如 2021" min={1900} max={2100} />
            </Form.Item>
            <Form.Item name="inspection_history" label="巡察历史" style={{ marginBottom: 0 }}>
              <Input placeholder="如 2021年第一轮、2023年第二轮" />
            </Form.Item>
          </>
        )}
        {modalFooter(() => { setEditModalOpen(false); setEditingUnit(null); }, handleEditSubmit)}
      </Form>
    </Modal>
  );

  return (
    <div>
      <PageHeader title="单位档案" breadcrumbs={[{ name: '档案管理' }, { name: '单位档案' }]} />
      <SearchForm fields={searchFields} onSearch={handleSearch} onReset={handleReset} />
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建单位</Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>导入</Button>
          <Button icon={<DownloadOutlined />} onClick={() => downloadUnitTemplate()}>下载模板</Button>
          <Button icon={<UploadOutlined />} onClick={exportUnits}>导出</Button>
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
      {renderCreateModal()}
      {renderEditModal()}
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
              <Upload accept=".xlsx" showUploadList={false} beforeUpload={handleImport}>
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
